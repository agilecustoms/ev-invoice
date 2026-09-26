import { Inject, Injectable, Logger } from '@nestjs/common'

export interface AirTableCredentials {
  apiKey: string
}

/**
 * Loads credentials on demand (Secrets Manager in AWS, .env.local locally). Called lazily on the first AirTable
 * call, so bootstrap and endpoints that do not need AirTable (e.g. /health) never touch the secret
 */
export type AirTableCredentialsLoader = () => Promise<AirTableCredentials>

export const AIRTABLE_CREDENTIALS = Symbol('AIRTABLE_CREDENTIALS')

/**
 * Thin wrapper around the AirTable REST API. The exact contract (base id, table/field names) is not settled yet,
 * so saveInvoiceId only logs for now - swap in the real fetch call once the contract is known
 */
@Injectable()
export class AirTableClient {
  private readonly logger = new Logger(AirTableClient.name)
  private credentials?: AirTableCredentials

  constructor(
    @Inject(AIRTABLE_CREDENTIALS)
    private readonly loadCredentials: AirTableCredentialsLoader,
  ) {}

  /**
   * Save PayPal invoice ID in AirTable
   */
  public async saveInvoiceId(orderId: number, invoiceId: string): Promise<void> {
    await this.getCredentials()

    this.logger.log(`saving invoice id ${invoiceId} for order ${orderId}`)
  }

  private async getCredentials(): Promise<AirTableCredentials> {
    if (!this.credentials) {
      this.credentials = await this.loadCredentials()
    }
    return this.credentials
  }
}
