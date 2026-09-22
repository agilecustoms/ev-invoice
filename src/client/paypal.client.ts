import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Customer } from '../model/customer.js'

const SANDBOX_URL = 'https://api-m.sandbox.paypal.com'
const LIVE_URL = 'https://api-m.paypal.com'

export interface PayPalCredentials {
  clientId: string
  clientSecret: string
}

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
  private token?: AccessToken

  constructor(
    @Inject(PAYPAL_CREDENTIALS)
    private readonly credentials: PayPalCredentials,
    config: ConfigService,
  ) {
    const env = config.get<string>('PAYPAL_ENV', 'live')
    if (env !== 'sandbox' && env !== 'live') {
      throw new Error(`Invalid PAYPAL_ENV '${env}', expected 'sandbox' or 'live'`)
    }
    this.baseUrl = env === 'live' ? LIVE_URL : SANDBOX_URL
  }

  /**
   * Creates a DRAFT invoice (it is not sent to the recipient yet)
   * @param customer invoice recipient
   * @param amount total in USD, e.g. 10.5
   * @returns PayPal invoice id, e.g. INV2-XXXX-XXXX-XXXX-XXXX
   */
  public async createInvoice(customer: Customer, amount: number): Promise<string> {
    const body = {
      detail: {
        currency_code: 'USD',
        note: 'Dummy invoice'
      },
      primary_recipients: [{
        billing_info: {
          name: { alternate_full_name: customer.name }, // a single 'name' string can not be reliably split into given_name/surname
          email_address: customer.email
        }
      }],
      items: [{
        name: 'Dummy item',
        quantity: '1',
        unit_amount: { currency_code: 'USD', value: amount.toFixed(2) } // PayPal wants a string with 2 decimals
      }]
    }

    const response = await this.request('/v2/invoicing/invoices', body)
    // PayPal responds with a link to the new invoice: { rel: 'self', href: '.../v2/invoicing/invoices/INV2-...' }
    const { href } = await response.json() as { href: string }
    const invoiceId = href.substring(href.lastIndexOf('/') + 1)
    this.logger.log(`Created PayPal invoice ${invoiceId}`)
    return invoiceId
  }

  private async request(path: string, body: unknown): Promise<Response> {
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

    const credentials = Buffer.from(`${this.credentials.clientId}:${this.credentials.clientSecret}`).toString('base64')
    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
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
}
