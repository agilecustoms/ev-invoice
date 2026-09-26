import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

/**
 * Loads the API token on demand (Secrets Manager in AWS, .env.local locally). Called lazily on the first AirTable
 * call, so bootstrap and endpoints that do not need AirTable (e.g. /health) never touch the secret
 */
export type AirTableCredentialsLoader = () => Promise<string>

export const AIRTABLE_CREDENTIALS = Symbol('AIRTABLE_CREDENTIALS')

// TODO: verify against the real base - these are guesses, not confirmed against the actual AirTable schema yet
const ORDER_ID_FIELD = 'Order ID'
const INVOICE_ID_FIELD = 'Invoice ID'

interface AirTableRecord {
  id: string
  fields: Record<string, unknown>
}

/**
 * Thin wrapper around the AirTable REST API (https://airtable.com/developers/web/api/introduction).
 * AIRTABLE_BASE_ID and AIRTABLE_TABLE_NAME are read lazily (like the credentials), so bootstrap and endpoints that
 * do not need AirTable never require them either - only saveInvoiceId does
 */
@Injectable()
export class AirTableClient {
  private readonly logger = new Logger(AirTableClient.name)
  private apiToken?: string

  constructor(
    @Inject(AIRTABLE_CREDENTIALS)
    private readonly loadApiToken: AirTableCredentialsLoader,
    private readonly config: ConfigService,
  ) {}

  /**
   * Records the PayPal invoice id against the order in AirTable. The update endpoint needs the record's own id
   * (recXXXXXXXXXXXXXX), not our numeric orderId, so the matching record is looked up by its Order ID field first
   */
  public async saveInvoiceId(orderId: number, invoiceId: string): Promise<void> {
    this.logger.log(`Saving invoice id ${invoiceId} for order ${orderId} in AirTable...`)

    const recordId = await this.findRecordId(orderId)
    await this.patch(recordId, { [INVOICE_ID_FIELD]: invoiceId })

    this.logger.log(`Saved invoice id ${invoiceId} for order ${orderId} in AirTable`)
  }

  private async findRecordId(orderId: number): Promise<string> {
    const formula = encodeURIComponent(`{${ORDER_ID_FIELD}}=${orderId}`)
    const response = await this.request(`?filterByFormula=${formula}&maxRecords=1`)
    const { records } = await response.json() as { records: AirTableRecord[] }
    const [record] = records
    if (!record) {
      throw new Error(`AirTable has no record with ${ORDER_ID_FIELD}=${orderId}`)
    }
    return record.id
  }

  private async patch(recordId: string, fields: Record<string, unknown>): Promise<void> {
    await this.request(`/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify({ fields })
    })
  }

  private async request(pathAndQuery: string, init?: { method: string, body: string }): Promise<Response> {
    if (!this.apiToken) {
      this.apiToken = await this.loadApiToken()
    }

    const baseId = this.config.getOrThrow<string>('AIRTABLE_BASE_ID')
    const table = this.config.getOrThrow<string>('AIRTABLE_TABLE_NAME')
    const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}${pathAndQuery}`

    const response = await fetch(url, {
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
