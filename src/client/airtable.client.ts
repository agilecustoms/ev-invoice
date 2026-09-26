import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

/**
 * Loads the API token on demand (Secrets Manager in AWS, .env.local locally). Called lazily on the first AirTable
 * call, so bootstrap and endpoints that do not need AirTable (e.g. /health) never touch the secret
 */
export type AirTableCredentialsLoader = () => Promise<string>

export const AIRTABLE_CREDENTIALS = Symbol('AIRTABLE_CREDENTIALS')

const TABLE_NAME = 'Orders'

/**
 * Thin wrapper around the AirTable REST API (https://airtable.com/developers/web/api/introduction)
 */
@Injectable()
export class AirTableClient {
  private readonly logger = new Logger(AirTableClient.name)
  private readonly tableUrl: string
  private apiToken?: string

  constructor(
    @Inject(AIRTABLE_CREDENTIALS)
    private readonly loadApiToken: AirTableCredentialsLoader,
    config: ConfigService,
  ) {
    const baseId = config.getOrThrow<string>('AIRTABLE_BASE_ID')
    this.tableUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(TABLE_NAME)}`
  }

  /**
   * @param recordId AirTable record id (recXXXXXXXXXXXXXX), not the order's numeric ID
   * @param invoiceId PayPal invoice id (INV2-XXXXXXXXXXXX)
   * @param deposit deposit amount in USD, saved back since it may have been defaulted rather than supplied
   */
  public async saveInvoice(recordId: string, invoiceId: string, deposit: number): Promise<void> {
    await this.request(`/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify({ fields: { invoiceId, Deposit: deposit } })
    })
  }

  private async request(pathAndQuery: string, init?: { method: string, body: string }): Promise<Response> {
    if (!this.apiToken) {
      this.apiToken = await this.loadApiToken()
    }

    const response = await fetch(`${this.tableUrl}${pathAndQuery}`, {
      method: init?.method ?? 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: init?.body
    })
    if (!response.ok) {
      throw new Error(`AirTable request to ${pathAndQuery} failed: ${response.status} ${await response.text()}`)
    }
    return response
  }
}
