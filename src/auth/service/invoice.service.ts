import { Injectable, Logger } from '@nestjs/common'

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name)

  constructor() { }

  public generateInvoice(): void {
    this.logger.log(`Generating invoice...`)
  }
}
