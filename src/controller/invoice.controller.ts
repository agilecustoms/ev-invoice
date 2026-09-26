import { Controller, Get, Query } from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'
import { CreateInvoiceDto } from '../dto/create-invoice.dto.js'
import { InvoiceService } from '../service/invoice.service.js'

@Controller()
export class InvoiceController {
  constructor(
    private readonly invoiceService: InvoiceService,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(InvoiceController.name)
  }

  /**
   * Generate a new invoice. Has to make it as a GET request due to AirTable limitations
   */
  @Get('/create')
  async createInvoice(@Query() request: CreateInvoiceDto): Promise<{ status: string }> {
    this.logger.assign({ endpoint: 'create', orderId: request.orderId })
    await this.invoiceService.createInvoice(request)
    return { status: 'success' }
  }
}
