import { Controller, Get, Query } from '@nestjs/common'
import { CreateInvoiceDto } from '../dto/create-invoice.dto.js'
import { InvoiceService } from '../service/invoice.service.js'

@Controller()
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  /**
   * Generate a new invoice. Has to make it as a GET request due to AirTable limitations
   */
  @Get('/create')
  async createInvoice(@Query() request: CreateInvoiceDto): Promise<{ status: string }> {
    await this.invoiceService.createInvoice(request)
    return { status: 'success' }
  }
}
