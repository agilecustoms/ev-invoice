import { BadRequestException, Controller, Get, Query } from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'
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
  async createInvoice(@Query('recordId') recordId: string): Promise<{ status: string }> {
    // goes into the AirTable URL path, so only let a well-formed record id through
    if (!/^rec[A-Za-z0-9]{14}$/.test(recordId ?? '')) {
      throw new BadRequestException('recordId must be an AirTable record id (recXXXXXXXXXXXXXX)')
    }
    this.logger.assign({ endpoint: 'create', recordId })
    await this.invoiceService.createInvoice(recordId)
    return { status: 'success' }
  }
}
