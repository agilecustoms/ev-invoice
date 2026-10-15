import { Temporal } from '@js-temporal/polyfill'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { validate } from 'class-validator'
import { AirTableClient } from '../client/airtable.client.js'
import { invoiceNote, PaypalClient } from '../client/paypal.client.js'
import { ScheduleClient } from '../client/schedule.client.js'
import type { InvoicePreviewRequest, InvoicePreviewResponse } from '../dto/invoice-preview.dto.js'
import { type OrderDto, OrderStatus, OrderType } from '../dto/order.dto.js'
import { BusinessException } from '../exception/business.exception.js'
import { parsePositiveDuration } from '../util/duration.js'

// statuses under which the order is still expected to happen; Done/Cancelled/Unavailable have no invoice to raise
const INVOICEABLE_STATUSES: ReadonlySet<OrderStatus> = new Set([
  OrderStatus.REQUESTED,
  OrderStatus.EV_REPLIED,
  OrderStatus.CONFIRMED,
])

// what is booked: the part of an order that business rules look at
type Booking = Pick<OrderDto, 'type' | 'serviceDate' | 'price' | 'deposit' | 'services'>

// no deposit in the order: assume 20% of the price, rounded up to the nearest $10
function defaultDeposit(price: number): number {
  return Math.ceil(price * 0.2 / 10) * 10
}

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name)
  private readonly depositTerm: Temporal.Duration // how long the customer has to pay the deposit

  constructor(
    private readonly paypalClient: PaypalClient,
    private readonly airTableClient: AirTableClient,
    private readonly scheduleClient: ScheduleClient,
    config: ConfigService,
  ) {
    this.depositTerm = parsePositiveDuration('DEPOSIT_TERM', config.getOrThrow<string>('DEPOSIT_TERM'))
  }

  public async createInvoice(recordId: string): Promise<void> {
    const order = await this.airTableClient.getOrder(recordId)
    this.logger.log(`Loaded order ${order.id} from AirTable`)

    await this.validate(order)
    this.enrich(order)
    await this.reconcileExistingInvoice(recordId)

    this.logger.log(`Create draft invoice`)
    const invoiceId = await this.paypalClient.createInvoice(order, this.depositTerm)

    this.logger.log(`Save invoice ${invoiceId} details in AirTable`)
    await this.airTableClient.patch(recordId, { 'invoiceId': invoiceId, 'Deposit': order.deposit, 'Invoice Status': 'DRAFT' })

    this.logger.log('Schedule expiry check')
    await this.scheduleClient.scheduleExpiryCheck(recordId, invoiceId, this.depositTerm)

    this.logger.log('Send invoice')
    await this.paypalClient.sendInvoice(invoiceId)

    this.logger.log('Update AirTable invoice status to SENT')
    await this.airTableClient.patch(recordId, { 'Invoice Status': 'SENT' })
  }

  /**
   * Dry run of createInvoice for a booking that is not in AirTable (yet): same booking rules and deposit default,
   * but no side effects - nothing is read from or written to AirTable, PayPal or Scheduler
   */
  public previewInvoice(booking: InvoicePreviewRequest): InvoicePreviewResponse {
    this.checkBookingRules(booking)
    const deposit = booking.deposit ?? defaultDeposit(booking.price)
    // through ZonedDateTime (UTC) because Instant can't add days, and the term may be configured in days
    const depositDueBy = Temporal.Now.zonedDateTimeISO('UTC').add(this.depositTerm).toInstant()
    this.logger.log(`Preview invoice for ${booking.type} on ${booking.serviceDate.toString()}, price ${booking.price}, deposit ${deposit}`)
    return {
      total: booking.price,
      deposit,
      defaultDeposit: booking.deposit === undefined,
      depositDueBy: depositDueBy.toString({ smallestUnit: 'second' }),
      balance: booking.price - deposit,
      balanceDueDate: booking.serviceDate.toString(),
      note: invoiceNote(deposit, this.depositTerm)
    }
  }

  /**
   * Fired by the expiry check schedule once the deposit term is over
   * @param recordId AirTable record id (recXXXXXXXXXXXXXX)
   * @param invoiceId PayPal invoice id, e.g. INV2-XXXX-XXXX-XXXX-XXXX
   */
  public checkExpiry(recordId: string, invoiceId: string): Promise<void> {
    this.logger.log(`Hello world! check expiry of invoice ${invoiceId} for order ${recordId}`)
    return Promise.resolve()
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
    this.logger.log(`Try to find existing invoice for order ${recordId}`)
    const existing = await this.paypalClient.findInvoiceByReference(recordId)
    if (!existing) {
      return
    }
    if (existing.status !== 'DRAFT') {
      throw new BusinessException(`can't send invoice, it is already ${existing.status}`)
    }
    this.logger.warn(`Found an existing draft invoice ${existing.id}, deleting it before creating a new one`)
    // schedule first: if deleting the invoice then fails, a retry finds the draft again and repeats both,
    // the other way around a failure would leave the schedule with nothing pointing to it
    await this.scheduleClient.deleteExpiryCheck(existing.id)
    await this.paypalClient.deleteInvoice(existing.id)
  }

  /**
   * The request (recordId) is fine at this point, it's the order data that breaks business rules -> 422, not 400
   */
  private async validate(request: OrderDto): Promise<void> {
    // the order comes from AirTable, not from the HTTP request, so the ValidationPipe never sees it
    const errors = await validate(request)
    if (errors.length > 0) {
      const messages = errors.flatMap(error => Object.values(error.constraints ?? {}))
      throw new BusinessException(messages.join('; '))
    }
    if (!INVOICEABLE_STATUSES.has(request.status)) {
      throw new BusinessException(`status must be one of: ${[...INVOICEABLE_STATUSES].join(', ')}`)
    }
    if (request.invoiceStatus !== undefined && request.invoiceStatus !== 'DRAFT') {
      throw new BusinessException('invoice status must be empty or DRAFT')
    }
    this.checkBookingRules(request)
  }

  /**
   * Rules about what is booked (not about the order lifecycle), so they can be checked for a booking that is not an order yet
   */
  private checkBookingRules(booking: Booking): void {
    if (Temporal.PlainDate.compare(booking.serviceDate, Temporal.Now.plainDateISO('UTC')) <= 0) {
      throw new BusinessException('service date must be in the future')
    }
    if (booking.type === OrderType.BRIDAL && !booking.services?.trim()) {
      throw new BusinessException('services must not be empty for type Bridal')
    }
    if (booking.deposit !== undefined && booking.deposit > booking.price) {
      throw new BusinessException('deposit must not exceed price')
    }
  }
}
