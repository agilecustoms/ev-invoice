import { Temporal } from '@js-temporal/polyfill'
import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { PaypalClient } from '../client/paypal.client.js'
import { type CreateInvoiceDto, OrderStatus, OrderType } from '../dto/create-invoice.dto.js'

// statuses under which the order is still expected to happen; Done/Cancelled/Unavailable have no invoice to raise
const INVOICEABLE_STATUSES: ReadonlySet<OrderStatus> = new Set([
  OrderStatus.REQUESTED,
  OrderStatus.EV_REPLIED,
  OrderStatus.CONFIRMED,
])

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name)

  constructor(private readonly paypalClient: PaypalClient) {}

  public async createInvoice(request: CreateInvoiceDto): Promise<void> {
    this.validate(request)

    this.logger.log(`Creating invoice for order ${request.orderId}...`)

    const invoiceId = await this.paypalClient.createInvoice(request)

    this.logger.log(`Created invoice ${invoiceId} for order ${request.orderId}`)
  }

  private validate(request: CreateInvoiceDto): void {
    if (!INVOICEABLE_STATUSES.has(request.orderStatus)) {
      throw new BadRequestException(`status must be one of: ${[...INVOICEABLE_STATUSES].join(', ')}`)
    }
    if (Temporal.PlainDate.compare(request.orderServiceDate, Temporal.Now.plainDateISO('UTC')) <= 0) {
      throw new BadRequestException('service date must be in the future')
    }
    if (request.orderType === OrderType.BRIDAL && !request.orderServices.trim()) {
      throw new BadRequestException('services must not be empty for orderType Bridal')
    }
  }
}
