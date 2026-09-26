import { Temporal } from '@js-temporal/polyfill'
import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { AirTableClient } from '../client/airtable.client.js'
import { PaypalClient } from '../client/paypal.client.js'
import { type CreateInvoiceDto, OrderStatus, OrderType } from '../dto/create-invoice.dto.js'

// statuses under which the order is still expected to happen; Done/Cancelled/Unavailable have no invoice to raise
const INVOICEABLE_STATUSES: ReadonlySet<OrderStatus> = new Set([
  OrderStatus.REQUESTED,
  OrderStatus.EV_REPLIED,
  OrderStatus.CONFIRMED,
])

// no deposit supplied on the request: assume 20% of the price, rounded up to the nearest $10
function defaultDeposit(price: number): number {
  return Math.ceil(price * 0.2 / 10) * 10
}

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name)

  constructor(
    private readonly paypalClient: PaypalClient,
    private readonly airTableClient: AirTableClient,
  ) {}

  public async createInvoice(request: CreateInvoiceDto): Promise<void> {
    this.validate(request)
    const orderId = request.orderId

    if (request.orderDeposit === undefined) {
      this.logger.log(`No deposit supplied for order ${orderId}, defaulting to 20% of the price`)
      request.orderDeposit = defaultDeposit(request.orderPrice)
    }

    this.logger.log(`Creating invoice for order ${orderId}...`)

    const invoiceId = await this.paypalClient.createInvoice(request)

    this.logger.log(`Created invoice ${invoiceId} for order ${orderId}`)

    await this.airTableClient.saveInvoiceId(orderId, invoiceId)
  }

  private validate(request: CreateInvoiceDto): void {
    if (!INVOICEABLE_STATUSES.has(request.orderStatus)) {
      throw new BadRequestException(`status must be one of: ${[...INVOICEABLE_STATUSES].join(', ')}`)
    }
    if (Temporal.PlainDate.compare(request.orderServiceDate, Temporal.Now.plainDateISO('UTC')) <= 0) {
      throw new BadRequestException('service date must be in the future')
    }
    if (request.orderType === OrderType.BRIDAL && !request.orderServices?.trim()) {
      throw new BadRequestException('services must not be empty for orderType Bridal')
    }
    if (request.orderDeposit !== undefined && request.orderDeposit > request.orderPrice) {
      throw new BadRequestException('deposit must not exceed price')
    }
  }
}
