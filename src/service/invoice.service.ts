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
    this.logger.log(`Loaded order ${order.id} from airtable`)
    await this.validate(order)

    if (order.deposit === undefined) {
      this.logger.log(`No deposit supplied, defaulting to 20% of the price`)
      order.deposit = defaultDeposit(order.price)
    }
    const deposit = order.deposit

    this.logger.log(`Create draft invoice`)
    const invoiceId = await this.paypalClient.createInvoice(order)

    this.logger.log(`Save invoice ${invoiceId} details in airtable`)
    await this.airTableClient.patch(recordId, { 'invoiceId': invoiceId, 'Deposit': deposit, 'Invoice Status': 'DRAFT' })

    this.logger.log('Send invoice')
    await this.paypalClient.sendInvoice(invoiceId)

    this.logger.log('Invoice sent, update airtable status')
    await this.airTableClient.patch(recordId, { 'Invoice Status': 'SENT' })
  }

  private async validate(request: OrderDto): Promise<void> {
    // the order comes from AirTable, not from the HTTP request, so the ValidationPipe never sees it
    const errors = await validate(request)
    if (errors.length > 0) {
      const messages = errors.flatMap(error => Object.values(error.constraints ?? {}))
      throw new BadRequestException(messages)
    }
    if (!INVOICEABLE_STATUSES.has(request.status)) {
      throw new BadRequestException(`status must be one of: ${[...INVOICEABLE_STATUSES].join(', ')}`)
    }
    if (Temporal.PlainDate.compare(request.serviceDate, Temporal.Now.plainDateISO('UTC')) <= 0) {
      throw new BadRequestException('service date must be in the future')
    }
    if (request.type === OrderType.BRIDAL && !request.services?.trim()) {
      throw new BadRequestException('services must not be empty for type Bridal')
    }
    if (request.deposit !== undefined && request.deposit > request.price) {
      throw new BadRequestException('deposit must not exceed price')
    }
  }
}
