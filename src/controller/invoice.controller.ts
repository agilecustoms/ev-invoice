import { Controller, Get, Header, ParseIntPipe, Query } from '@nestjs/common'
import { InvoiceService } from '../service/invoice.service.js'

@Controller()
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  /**
   * Generate a new invoice. Has to make it as a GET request due to AirTable limitations
   */
  @Get('/create')
  @Header('Content-Type', 'text/plain')
  async createInvoice(@Query('orderId', ParseIntPipe) orderId: number): Promise<string> {
    await this.invoiceService.createInvoice(orderId)
    return 'ok'
  }
}
