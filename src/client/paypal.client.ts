import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { CreateInvoiceDto } from '../dto/create-invoice.dto.js'

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
  public async createInvoice(request: CreateInvoiceDto): Promise<string> {
    const dueDateIso = '2026-10-01' // TODO:
    const serviceDate = 'Nov 1, 2026' // TODO:
    // 'Venue address: 7643 Pineville-Matthews Rd, Charlotte, NC 28226\nDate: Nov-11, 2026, Completion time: 2:00pm\nServices: Trial makup at studio, Bridal Makeup at the venue, Makeup for 4 bride maids'
    const description = [
      `Venue address: ${request.orderAddress}`,
      `Date: ${serviceDate}, Completion time: ${request.orderCompletionTime}`,
      `Services: ${request.orderServices}`
    ].join('\n')

    const phone = (phone: string) => ({ country_code: '1', national_number: phone, phone_type: 'MOBILE' })
    const amount = (value: number) => ({ currency_code: 'USD', value: value.toFixed(2) })
    const name = (fullName: string) => ({ full_name: fullName })

    const body = {
      detail: {
        currency_code: 'USD',
        reference: request.orderId,
        note: `$${request.orderDeposit} deposit due in 48 hours to reserve your date. Balance due on service date`,
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
          name: name(request.customerName),
          email_address: request.customerEmail,
          phones: [phone(request.customerPhone)]
        }
      }],
      additional_recipients: ['chekulaevalexey@gmail.com', 'evelin.novshadyan@gmail.com'],
      items: [{
        name: 'Makeup Service',
        description,
        quantity: '1',
        unit_amount: amount(request.orderPrice),
        unit_of_measure: 'AMOUNT'
      }],
      configuration: {
        allow_tip: true,
        partial_payment: {
          allow_partial_payment: true,
          minimum_amount_due: amount(request.orderDeposit)
        }
      }
    }

    const response = await this.post('/v2/invoicing/invoices', body)

    // PayPal responds with a link to the new invoice: { rel: 'self', href: '.../v2/invoicing/invoices/INV2-...' }
    const { href } = await response.json() as { href: string }
    const invoiceId = href.substring(href.lastIndexOf('/') + 1)
    this.logger.log(`Created PayPal invoice ${invoiceId}`)
    return invoiceId
  }

  private async post(path: string, body: unknown): Promise<Response> {
    const response = await fetch(this.baseUrl + path, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${await this.getAccessToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
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
