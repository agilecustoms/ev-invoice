import { Injectable, Logger } from '@nestjs/common'
import { PaypalClient } from '../client/paypal.client.js'
import type { Customer } from '../model/customer.js'

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name)

  constructor(private readonly paypalClient: PaypalClient) {}

  public async createInvoice(orderId: number): Promise<void> {
    this.logger.log(`Creating invoice for order ${orderId}...`)

    // TODO: replace with the real customer/amount for this order (e.g. looked up from AirTable)
    const customer: Customer = { name: 'John Doe', email: 'john.doe@example.com' }
    const amount = 10

    const invoiceId = await this.paypalClient.createInvoice(customer, amount)
    this.logger.log(`Created invoice ${invoiceId} for order ${orderId}`)
  }
}
