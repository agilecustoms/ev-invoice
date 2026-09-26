import { Temporal } from '@js-temporal/polyfill'
import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { validate } from 'class-validator'
import { AirTableClient } from '../client/airtable.client.js'
import { PaypalClient } from '../client/paypal.client.js'
import { type OrderDto, OrderStatus, OrderType } from '../dto/order.dto.js'

// statuses under which the order is still expected to happen; Done/Cancelled/Unavailable have no invoice to raise
const INVOICEABLE_STATUSES: ReadonlySet<OrderStatus> = new Set([
  OrderStatus.REQUESTED,
  OrderStatus.EV_REPLIED,
  OrderStatus.CONFIRMED,
])

// no deposit in the order: assume 20% of the price, rounded up to the nearest $10
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

  public async createInvoice(recordId: string): Promise<void> {
    const order = await this.airTableClient.getOrder(recordId)
    this.logger.log(`Loaded order ${order.orderId} from airtable`)
    await this.validate(order)

    if (order.orderDeposit === undefined) {
      this.logger.log(`No deposit supplied, defaulting to 20% of the price`)
      order.orderDeposit = defaultDeposit(order.orderPrice)
    }
    const deposit = order.orderDeposit

    this.logger.log(`Creating invoice...`)
    const invoiceId = await this.paypalClient.createInvoice(order)

    this.logger.log(`Save invoice ID ${invoiceId} and deposit $${deposit} to airtable`)
    await this.airTableClient.saveInvoice(recordId, invoiceId, deposit)
  }

  private async validate(request: OrderDto): Promise<void> {
    // the order comes from AirTable, not from the HTTP request, so the ValidationPipe never sees it
    const errors = await validate(request)
    if (errors.length > 0) {
      const messages = errors.flatMap(error => Object.values(error.constraints ?? {}))
      throw new BadRequestException(messages)
    }
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
