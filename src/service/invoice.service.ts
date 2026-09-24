import { Injectable, Logger } from '@nestjs/common'
import { PaypalClient } from '../client/paypal.client.js'
import type { CreateInvoiceDto } from '../dto/create-invoice.dto.js'

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name)

  constructor(private readonly paypalClient: PaypalClient) {}

  public async createInvoice(request: CreateInvoiceDto): Promise<void> {
    this.logger.log(`Creating invoice for order ${request.orderId}...`)

    const invoiceId = await this.paypalClient.createInvoice(request)

    this.logger.log(`Created invoice ${invoiceId} for order ${request.orderId}`)
  }
}
