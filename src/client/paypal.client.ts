import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { parsePhoneNumberWithError } from 'libphonenumber-js'
import type { OrderDto } from '../dto/order.dto.js'

// https://developer.paypal.com/docs/api/invoicing/v2/#definition-invoice_status
export type InvoiceStatus = 'DRAFT' | 'SENT' | 'SCHEDULED' | 'PAYMENT_PENDING' | 'UNPAID' | 'PARTIALLY_PAID' | 'PAID'
  | 'MARKED_AS_PAID' | 'CANCELLED' | 'REFUNDED' | 'PARTIALLY_REFUNDED' | 'MARKED_AS_REFUNDED'

export interface PayPalCredentials {
  clientId: string
  clientSecret: string
}

/**
 * Loads credentials on demand (Secrets Manager in AWS, .env.local locally). Called lazily on the first PayPal call,
 * so bootstrap and endpoints that do not need PayPal (e.g. /health) never touch the secret
 */
export type PayPalCredentialsLoader = () => Promise<PayPalCredentials>

export const PAYPAL_CREDENTIALS = Symbol('PAYPAL_CREDENTIALS')

interface AccessToken {
  value: string
  expiresAt: number // epoch millis
}

/**
 * Thin wrapper around PayPal REST API (https://developer.paypal.com/docs/api/invoicing/v2/)
 */
@Injectable()
export class PaypalClient {
  private readonly logger = new Logger(PaypalClient.name)
  private readonly baseUrl: string
  private credentials?: PayPalCredentials
  private token?: AccessToken

  constructor(
    @Inject(PAYPAL_CREDENTIALS)
    private readonly loadCredentials: PayPalCredentialsLoader,
    config: ConfigService,
  ) {
    this.baseUrl = config.getOrThrow<string>('PAYPAL_URL')
  }

  /**
   * Creates a DRAFT invoice (it is not sent to the recipient yet)
   * @returns PayPal invoice id, e.g. INV2-XXXX-XXXX-XXXX-XXXX
   */
  public async createInvoice(order: OrderDto): Promise<string> {
    const dueDateIso = order.serviceDate.toString() // e.g. 2026-10-04
    const serviceDate = order.serviceDate.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) // e.g. Oct 4, 2026

    // Venue address: 7643 Pineville-Matthews Rd, Charlotte, NC 28226
    // Date: Nov-11, 2026, Completion time: 2:00pm
    // Services: Trial makeup at Studio, Bridal Makeup at the venue, Makeup for 4 bride maids
    const description = [
      order.address && `Venue address: ${order.address}`,
      `Date: ${serviceDate}, Completion time: ${order.completionTime}`,
      order.services && `Services: ${order.services}`
    ].filter(line => !!line).join('\n')

    const phone = (text: string) => {
      // PayPal wants the country code and digits-only national number separately: +1 (203) 570-0477 -> 1 / 2035700477
      const { countryCallingCode, nationalNumber } = parsePhoneNumberWithError(text, 'US')
      return { country_code: countryCallingCode, national_number: nationalNumber, phone_type: 'MOBILE' }
    }
    const amount = (value: number) => ({ currency_code: 'USD', value: value.toFixed(2) })
    const name = (fullName: string) => ({ full_name: fullName })

    const deposit = order.deposit

    const body = {
      detail: {
        currency_code: 'USD',
        reference: order.recordId,
        note: deposit === undefined
          ? 'Balance due on service date'
          : `$${deposit} deposit due in 48 hours to reserve your date. Balance due on service date`,
        tip_presets: ['15', '20', '25'],
        payment_term: {
          term_type: 'DUE_ON_DATE_SPECIFIED',
          due_date: dueDateIso
        },
        payment_terms: 'A minimum deposit of $200 must be paid within 48 hours to reserve your appointment. Until the deposit is paid, the requested date and time are not guaranteed and may be booked by another client. By paying the deposit, you agree to pay the remaining balance by the service date',
        cancellation_policy: 'The deposit is non-refundable and reserves your appointment date and time. If you need to cancel or reschedule, please contact Makeup by Evelin as soon as possible'
      },
      invoicer: {
        business_name: 'Makeup by Evelin',
        name: name('Evelin Chekulaieva'),
        email_address: 'makeupwith.evelin@gmail.com',
        phones: [phone('4754195725')],
        website: 'evelinmakeup.com'
      },
      primary_recipients: [{
        billing_info: {
          name: name(order.customerName),
          email_address: order.customerEmail,
          phones: [phone(order.customerPhone)]
        }
      }],
      additional_recipients: ['chekulaevalexey@gmail.com', 'evelin.novshadyan@gmail.com'],
      items: [{
        name: 'Makeup Service',
        description,
        quantity: '1',
        unit_amount: amount(order.price),
        unit_of_measure: 'AMOUNT'
      }],
      configuration: {
        allow_tip: true,
        ...deposit !== undefined && {
          partial_payment: {
            allow_partial_payment: true,
            minimum_amount_due: amount(deposit)
          }
        }
      }
    }

    const response = await this.request('POST', '/v2/invoicing/invoices', body)

    // PayPal responds with a link to the new invoice: { rel: 'self', href: '.../v2/invoicing/invoices/INV2-...' }
    const { href } = await response.json() as { href: string }
    return href.substring(href.lastIndexOf('/') + 1)
  }

  /**
   * Sends a DRAFT invoice to the recipient (and additional recipients), which also moves it to status SENT
   * @param invoiceId PayPal invoice id, e.g. INV2-XXXX-XXXX-XXXX-XXXX
   */
  public async sendInvoice(invoiceId: string): Promise<void> {
    await this.request('POST', `/v2/invoicing/invoices/${invoiceId}/send`, {})
  }

  /**
   * @param invoiceId PayPal invoice id, e.g. INV2-XXXX-XXXX-XXXX-XXXX
   */
  public async getInvoiceStatus(invoiceId: string): Promise<InvoiceStatus> {
    const response = await this.request('GET', `/v2/invoicing/invoices/${invoiceId}`)
    const { status } = await response.json() as { status: InvoiceStatus }
    return status
  }

  private async request(method: 'GET' | 'POST', path: string, body?: unknown): Promise<Response> {
    const response = await fetch(this.baseUrl + path, {
      method,
      headers: {
        'Authorization': `Bearer ${await this.getAccessToken()}`,
        'Content-Type': 'application/json'
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    })
    if (!response.ok) {
      throw new Error(`PayPal ${path} failed: ${response.status} ${await response.text()}`)
    }
    return response
  }

  /**
   * OAuth2 client credentials flow. Token lives ~9 hours, so we cache it (in a warm Lambda too)
   */
  private async getAccessToken(): Promise<string> {
    const now = Date.now()
    if (this.token && this.token.expiresAt - 60_000 > now) {
      return this.token.value
    }

    if (!this.token) {
      this.logger.log('Fetching PayPal access token...')
    } else {
      this.logger.log('Refreshing PayPal access token...')
    }

    const { clientId, clientSecret } = await this.getCredentials()
    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    })
    if (!response.ok) {
      throw new Error(`PayPal authentication failed: ${response.status} ${await response.text()}`)
    }
    const { access_token, expires_in } = await response.json() as { access_token: string, expires_in: number }
    this.token = { value: access_token, expiresAt: now + expires_in * 1000 }
    return access_token
  }

  private async getCredentials(): Promise<PayPalCredentials> {
    if (!this.credentials) {
      this.credentials = await this.loadCredentials() // a failed load throws before the assignment, so it is never cached
    }
    return this.credentials
  }
}
