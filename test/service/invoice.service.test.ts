import { Temporal } from '@js-temporal/polyfill'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AirTableClient } from '../../src/client/airtable.client.js'
import { PaypalClient } from '../../src/client/paypal.client.js'
import { ScheduleClient } from '../../src/client/schedule.client.js'
import { OrderDto, OrderStatus, OrderType } from '../../src/dto/order.dto.js'
import { InvoiceService } from '../../src/service/invoice.service.js'

const RECORD_ID = 'recDkcV8BUDP5kfkX'

function validOrder(): OrderDto {
  const order = new OrderDto()
  order.recordId = RECORD_ID
  order.id = 1
  order.customerName = 'Jane Doe'
  order.customerEmail = 'jane@example.com'
  order.customerPhone = '2035700477'
  order.type = OrderType.BRIDAL
  order.status = OrderStatus.CONFIRMED
  order.price = 500
  order.serviceDate = Temporal.Now.plainDateISO('UTC').add({ days: 1 })
  order.completionTime = '2:00pm'
  order.services = 'Bridal Makeup'
  return order
}

describe('InvoiceService', () => {
  let paypalClient: PaypalClient
  let airTableClient: AirTableClient
  let scheduleClient: ScheduleClient
  let invoiceService: InvoiceService
  let order: OrderDto

  beforeEach(() => {
    order = validOrder()
    paypalClient = {
      createInvoice: vi.fn().mockResolvedValue('INV2-XXXX'),
      sendInvoice: vi.fn(),
      findInvoiceByReference: vi.fn().mockResolvedValue(undefined),
      deleteInvoice: vi.fn()
    } as unknown as PaypalClient
    airTableClient = {
      getOrder: vi.fn().mockImplementation(() => Promise.resolve(order)),
      patch: vi.fn()
    } as unknown as AirTableClient
    scheduleClient = { scheduleExpiryCheck: vi.fn(), deleteExpiryCheck: vi.fn() } as unknown as ScheduleClient
    invoiceService = new InvoiceService(paypalClient, airTableClient, scheduleClient)
  })

  it('loads the order by record id', async () => {
    await invoiceService.createInvoice(RECORD_ID)

    expect(airTableClient.getOrder).toHaveBeenCalledWith(RECORD_ID)
  })

  it('rejects an order with invalid fields', async () => {
    order.customerEmail = 'not-an-email'

    await expect(invoiceService.createInvoice(RECORD_ID)).rejects.toThrow()
    expect(paypalClient.createInvoice).not.toHaveBeenCalled()
  })

  it('rejects an order status that is not invoiceable', async () => {
    order.status = OrderStatus.DONE

    await expect(invoiceService.createInvoice(RECORD_ID)).rejects.toThrow(/status/)
    expect(paypalClient.createInvoice).not.toHaveBeenCalled()
  })

  it('rejects a service date that is not in the future', async () => {
    order.serviceDate = Temporal.Now.plainDateISO('UTC')

    await expect(invoiceService.createInvoice(RECORD_ID)).rejects.toThrow(/future/)
    expect(paypalClient.createInvoice).not.toHaveBeenCalled()
  })

  it('rejects an empty services for a Bridal order', async () => {
    order.services = '  '

    await expect(invoiceService.createInvoice(RECORD_ID)).rejects.toThrow(/services/)
    expect(paypalClient.createInvoice).not.toHaveBeenCalled()
  })

  it('rejects a deposit that exceeds the price', async () => {
    order.price = 100
    order.deposit = 150

    await expect(invoiceService.createInvoice(RECORD_ID)).rejects.toThrow(/deposit/)
    expect(paypalClient.createInvoice).not.toHaveBeenCalled()
  })

  it('rejects an invoice status that is not empty or DRAFT', async () => {
    order.invoiceStatus = 'SENT'

    await expect(invoiceService.createInvoice(RECORD_ID)).rejects.toThrow(/invoice status/)
    expect(paypalClient.createInvoice).not.toHaveBeenCalled()
  })

  it('accepts an order whose invoice status is DRAFT', async () => {
    order.invoiceStatus = 'DRAFT'

    await invoiceService.createInvoice(RECORD_ID)

    expect(paypalClient.createInvoice).toHaveBeenCalled()
  })

  it('rejects when PayPal already has a non-draft invoice for this order', async () => {
    vi.mocked(paypalClient.findInvoiceByReference).mockResolvedValue({ id: 'INV2-OLD', status: 'SENT' })

    await expect(invoiceService.createInvoice(RECORD_ID)).rejects.toThrow(/already SENT/)
    expect(paypalClient.deleteInvoice).not.toHaveBeenCalled()
    expect(scheduleClient.deleteExpiryCheck).not.toHaveBeenCalled()
    expect(paypalClient.createInvoice).not.toHaveBeenCalled()
  })

  it('deletes an existing draft invoice for this order before creating a new one', async () => {
    vi.mocked(paypalClient.findInvoiceByReference).mockResolvedValue({ id: 'INV2-OLD', status: 'DRAFT' })

    await invoiceService.createInvoice(RECORD_ID)

    expect(paypalClient.findInvoiceByReference).toHaveBeenCalledWith(RECORD_ID)
    expect(paypalClient.deleteInvoice).toHaveBeenCalledWith('INV2-OLD')
    const [deletion] = vi.mocked(paypalClient.deleteInvoice).mock.invocationCallOrder
    const [creation] = vi.mocked(paypalClient.createInvoice).mock.invocationCallOrder
    expect(deletion).toBeLessThan(creation!)
  })

  it('deletes the expiry check of the existing draft invoice before the invoice itself', async () => {
    vi.mocked(paypalClient.findInvoiceByReference).mockResolvedValue({ id: 'INV2-OLD', status: 'DRAFT' })

    await invoiceService.createInvoice(RECORD_ID)

    expect(scheduleClient.deleteExpiryCheck).toHaveBeenCalledWith('INV2-OLD')
    const [scheduleDeletion] = vi.mocked(scheduleClient.deleteExpiryCheck).mock.invocationCallOrder
    const [invoiceDeletion] = vi.mocked(paypalClient.deleteInvoice).mock.invocationCallOrder
    expect(scheduleDeletion).toBeLessThan(invoiceDeletion!)
  })

  it('does not delete any expiry check when there is no existing invoice', async () => {
    await invoiceService.createInvoice(RECORD_ID)

    expect(scheduleClient.deleteExpiryCheck).not.toHaveBeenCalled()
  })

  it('does not look up an existing invoice when the order itself is invalid', async () => {
    order.customerEmail = 'not-an-email'

    await expect(invoiceService.createInvoice(RECORD_ID)).rejects.toThrow()
    expect(paypalClient.findInvoiceByReference).not.toHaveBeenCalled()
  })

  it('defaults the deposit to 20% of the price, rounded up to the nearest $10', async () => {
    order.price = 155

    await invoiceService.createInvoice(RECORD_ID)

    expect(paypalClient.createInvoice).toHaveBeenCalledWith(expect.objectContaining({ deposit: 40 }))
  })

  it('saves the PayPal invoice id and supplied deposit in AirTable', async () => {
    order.deposit = 150

    await invoiceService.createInvoice(RECORD_ID)

    expect(airTableClient.patch).toHaveBeenNthCalledWith(1, RECORD_ID, { 'invoiceId': 'INV2-XXXX', 'Deposit': 150, 'Invoice Status': 'DRAFT' })
  })

  it('saves the draft in AirTable, sends the invoice, then marks it SENT in AirTable', async () => {
    await invoiceService.createInvoice(RECORD_ID)

    expect(paypalClient.sendInvoice).toHaveBeenCalledWith('INV2-XXXX')
    expect(airTableClient.patch).toHaveBeenCalledTimes(2)
    expect(airTableClient.patch).toHaveBeenNthCalledWith(2, RECORD_ID, { 'Invoice Status': 'SENT' })

    const [draftPatch, sentPatch] = vi.mocked(airTableClient.patch).mock.invocationCallOrder
    const [send] = vi.mocked(paypalClient.sendInvoice).mock.invocationCallOrder
    expect(draftPatch).toBeLessThan(send!)
    expect(send).toBeLessThan(sentPatch!)
  })

  it('schedules the expiry check after saving the draft and before sending', async () => {
    await invoiceService.createInvoice(RECORD_ID)

    expect(scheduleClient.scheduleExpiryCheck).toHaveBeenCalledWith(RECORD_ID, 'INV2-XXXX')
    const [draftPatch] = vi.mocked(airTableClient.patch).mock.invocationCallOrder
    const [schedule] = vi.mocked(scheduleClient.scheduleExpiryCheck).mock.invocationCallOrder
    const [send] = vi.mocked(paypalClient.sendInvoice).mock.invocationCallOrder
    expect(draftPatch).toBeLessThan(schedule!)
    expect(schedule).toBeLessThan(send!)
  })

  it('does not send the invoice when scheduling the expiry check fails', async () => {
    vi.mocked(scheduleClient.scheduleExpiryCheck).mockRejectedValueOnce(new Error('Scheduler is down'))

    await expect(invoiceService.createInvoice(RECORD_ID)).rejects.toThrow('Scheduler is down')

    expect(paypalClient.sendInvoice).not.toHaveBeenCalled()
  })

  it('does not mark the invoice SENT in AirTable when sending fails', async () => {
    vi.mocked(paypalClient.sendInvoice).mockRejectedValueOnce(new Error('PayPal is down'))

    await expect(invoiceService.createInvoice(RECORD_ID)).rejects.toThrow('PayPal is down')

    expect(airTableClient.patch).toHaveBeenCalledTimes(1)
    expect(airTableClient.patch).toHaveBeenCalledWith(RECORD_ID, expect.objectContaining({ 'Invoice Status': 'DRAFT' }))
  })

  it('saves the defaulted deposit in AirTable', async () => {
    order.price = 155

    await invoiceService.createInvoice(RECORD_ID)

    expect(airTableClient.patch).toHaveBeenNthCalledWith(1, RECORD_ID, expect.objectContaining({ Deposit: 40 }))
  })
})
