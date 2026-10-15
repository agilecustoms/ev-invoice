import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common'
import { ApiOkResponse, ApiUnprocessableEntityResponse } from '@nestjs/swagger'
import { PinoLogger } from 'nestjs-pino'
import { InvoicePreviewRequest, InvoicePreviewResponse } from '../dto/invoice-preview.dto.js'
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

  /**
   * Preview the invoice /create would send for a booking: deposit (default if not given), deadlines and balance.
   * Read-only, so 200 (Nest default for POST is 201 Created)
   */
  @Post('/invoice/preview')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: InvoicePreviewResponse })
  @ApiUnprocessableEntityResponse({ description: 'booking breaks a business rule, e.g. service date is not in the future' })
  previewInvoice(@Body() booking: InvoicePreviewRequest): InvoicePreviewResponse {
    this.logger.assign({ endpoint: 'preview' })
    return this.invoiceService.previewInvoice(booking)
  }
}
