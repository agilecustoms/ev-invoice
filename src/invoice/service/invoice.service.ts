import { Injectable, Logger } from '@nestjs/common'

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name)

  constructor() { }

  public createInvoice(orderId: number): void {
    this.logger.log(`Creating invoice for order ${orderId}...`)
  }
}
