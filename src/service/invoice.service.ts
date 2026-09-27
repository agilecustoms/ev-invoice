import { Temporal } from '@js-temporal/polyfill'
import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { validate } from 'class-validator'
import { AirTableClient } from '../client/airtable.client.js'
import { PaypalClient } from '../client/paypal.client.js'
import { ScheduleClient } from '../client/schedule.client.js'
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
    private readonly scheduleClient: ScheduleClient,
  ) {}

  public async createInvoice(recordId: string): Promise<void> {
    const order = await this.airTableClient.getOrder(recordId)
    this.logger.log(`Loaded order ${order.id} from AirTable`)
    await this.validate(order)
    this.enrich(order)
    await this.reconcileExistingInvoice(recordId)

    this.logger.log(`Create draft invoice`)
    const invoiceId = await this.paypalClient.createInvoice(order)

    this.logger.log(`Save invoice ${invoiceId} details in AirTable`)
    await this.airTableClient.patch(recordId, { 'invoiceId': invoiceId, 'Deposit': order.deposit, 'Invoice Status': 'DRAFT' })

    this.logger.log('Schedule expiry check')
    await this.scheduleClient.scheduleExpiryCheck(recordId, invoiceId)

    this.logger.log('Send invoice')
    await this.paypalClient.sendInvoice(invoiceId)

    this.logger.log('Update AirTable invoice status to SENT')
    await this.airTableClient.patch(recordId, { 'Invoice Status': 'SENT' })
  }

  /**
   * Fills in what AirTable may leave empty
   */
  private enrich(order: OrderDto): void {
    if (order.deposit === undefined) {
      order.deposit = defaultDeposit(order.price)
      this.logger.log(`No deposit supplied, defaulting to 20% of the price ($${order.deposit})`)
    }
  }

  /**
   * A retry after a partial failure could find PayPal already has an invoice for this order (created on an earlier,
   * interrupted attempt). A DRAFT one is safe to discard and recreate; anything past DRAFT means the invoice is
   * already out in the world, so we must not silently create a second one for the same order
   */
  private async reconcileExistingInvoice(recordId: string): Promise<void> {
    const existing = await this.paypalClient.findInvoiceByReference(recordId)
    if (!existing) {
      return
    }
    if (existing.status !== 'DRAFT') {
      throw new BadRequestException(`can't send invoice, it is already ${existing.status}`)
    }
    this.logger.warn(`Found an existing draft invoice ${existing.id}, deleting it before creating a new one`)
    await this.paypalClient.deleteInvoice(existing.id)
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
    if (request.invoiceStatus !== undefined && request.invoiceStatus !== 'DRAFT') {
      throw new BadRequestException('invoice status must be empty or DRAFT')
    }
  }
}
