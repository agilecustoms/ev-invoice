import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { plainToInstance } from 'class-transformer'
import { OrderDto } from '../dto/order.dto.js'
import type { InvoiceStatus } from './paypal.client.js'

/**
 * Loads the API token on demand (Secrets Manager in AWS, .env.local locally). Called lazily on the first AirTable
 * call, so bootstrap and endpoints that do not need AirTable (e.g. /health) never touch the secret
 */
export type AirTableCredentialsLoader = () => Promise<string>

export const AIRTABLE_CREDENTIALS = Symbol('AIRTABLE_CREDENTIALS')

/**
 * Orders fields this service is allowed to write, keyed by their AirTable field names
 */
export interface OrderPatch {
  'Deposit'?: number
  'Invoice Status'?: InvoiceStatus
  'invoiceId'?: string
}

const TABLE_NAME = 'Orders'

/**
 * Thin wrapper around the AirTable REST API (https://airtable.com/developers/web/api/introduction)
 */
@Injectable()
export class AirTableClient {
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
   * Loads the order and maps AirTable field names to OrderDto. Not validated here, see InvoiceService.
   * AirTable omits empty fields from the response, so they come as undefined
   * @param recordId AirTable record id (recXXXXXXXXXXXXXX), not the order's numeric ID
   */
  public async getOrder(recordId: string): Promise<OrderDto> {
    const response = await this.request(`/${recordId}`)
    const { id, fields } = await response.json() as { id: string, fields: Record<string, unknown> }
    return plainToInstance(OrderDto, {
      recordId: id,
      customerName: fields['Name'],
      customerEmail: fields['email'],
      customerPhone: fields['Phone'],
      id: fields['ID'],
      status: fields['Status'],
      type: fields['Type'],
      price: fields['Price'],
      deposit: fields['Deposit'],
      address: fields['Address'],
      serviceDate: fields['Date'],
      completionTime: fields['Time'],
      services: fields['Services'],
      invoiceId: fields['invoiceId'],
      invoiceStatus: fields['Invoice Status'],
    })
  }

  /**
   * Updates only the given fields, the rest of the record stays as is
   * @param recordId AirTable record id (recXXXXXXXXXXXXXX), not the order's numeric ID
   * @param fields to patch
   */
  public async patch(recordId: string, fields: OrderPatch): Promise<void> {
    await this.request(`/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify({ fields })
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
