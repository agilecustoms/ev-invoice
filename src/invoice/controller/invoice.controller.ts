import { Controller, Get } from '@nestjs/common'
import { InvoiceService } from '../service/invoice.service.js'

@Controller()
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  /**
   * Generate a new invoice. Has to make it as a GET request due to AirTable limitations
   */
  @Get('/create')
  createInvoice(): void {
    this.invoiceService.generateInvoice()
  }
}
