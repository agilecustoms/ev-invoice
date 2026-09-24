import { Controller, Get, Header, Query } from '@nestjs/common'
import { CreateInvoiceDto } from '../dto/create-invoice.dto.js'
import { InvoiceService } from '../service/invoice.service.js'

@Controller()
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  /**
   * Generate a new invoice. Has to make it as a GET request due to AirTable limitations
   */
  @Get('/create')
  @Header('Content-Type', 'text/plain')
  async createInvoice(@Query() request: CreateInvoiceDto): Promise<string> {
    await this.invoiceService.createInvoice(request)
    return 'ok'
  }
}
