import { Temporal } from '@js-temporal/polyfill'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AirTableClient } from '../../src/client/airtable.client.js'
import { PaypalClient } from '../../src/client/paypal.client.js'
import { OrderDto, OrderStatus, OrderType } from '../../src/dto/order.dto.js'
import { InvoiceService } from '../../src/service/invoice.service.js'

const RECORD_ID = 'recDkcV8BUDP5kfkX'

function validOrder(): OrderDto {
  const order = new OrderDto()
  order.orderId = 1
  order.customerName = 'Jane Doe'
  order.customerEmail = 'jane@example.com'
  order.customerPhone = '2035700477'
  order.orderType = OrderType.BRIDAL
  order.orderStatus = OrderStatus.CONFIRMED
  order.orderPrice = 500
  order.orderServiceDate = Temporal.Now.plainDateISO('UTC').add({ days: 1 })
  order.orderCompletionTime = '2:00pm'
  order.orderServices = 'Bridal Makeup'
  return order
}

describe('InvoiceService', () => {
  let paypalClient: PaypalClient
  let airTableClient: AirTableClient
  let invoiceService: InvoiceService
  let order: OrderDto

  beforeEach(() => {
    order = validOrder()
    paypalClient = { createInvoice: vi.fn().mockResolvedValue('INV2-XXXX') } as unknown as PaypalClient
    airTableClient = {
      getOrder: vi.fn().mockImplementation(() => Promise.resolve(order)),
      saveInvoice: vi.fn()
    } as unknown as AirTableClient
    invoiceService = new InvoiceService(paypalClient, airTableClient)
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
    order.orderStatus = OrderStatus.DONE

    await expect(invoiceService.createInvoice(RECORD_ID)).rejects.toThrow(/status/)
    expect(paypalClient.createInvoice).not.toHaveBeenCalled()
  })

  it('rejects a service date that is not in the future', async () => {
    order.orderServiceDate = Temporal.Now.plainDateISO('UTC')

    await expect(invoiceService.createInvoice(RECORD_ID)).rejects.toThrow(/future/)
    expect(paypalClient.createInvoice).not.toHaveBeenCalled()
  })

  it('rejects an empty orderServices for a Bridal order', async () => {
    order.orderServices = '  '

    await expect(invoiceService.createInvoice(RECORD_ID)).rejects.toThrow(/services/)
    expect(paypalClient.createInvoice).not.toHaveBeenCalled()
  })

  it('rejects a deposit that exceeds the price', async () => {
    order.orderPrice = 100
    order.orderDeposit = 150

    await expect(invoiceService.createInvoice(RECORD_ID)).rejects.toThrow(/deposit/)
    expect(paypalClient.createInvoice).not.toHaveBeenCalled()
  })

  it('defaults the deposit to 20% of the price, rounded up to the nearest $10', async () => {
    order.orderPrice = 155

    await invoiceService.createInvoice(RECORD_ID)

    expect(paypalClient.createInvoice).toHaveBeenCalledWith(expect.objectContaining({ orderDeposit: 40 }))
  })

  it('saves the PayPal invoice id and supplied deposit in AirTable', async () => {
    order.orderDeposit = 150

    await invoiceService.createInvoice(RECORD_ID)

    expect(airTableClient.saveInvoice).toHaveBeenCalledWith(RECORD_ID, 'INV2-XXXX', 150)
  })

  it('saves the defaulted deposit in AirTable', async () => {
    order.orderPrice = 155

    await invoiceService.createInvoice(RECORD_ID)

    expect(airTableClient.saveInvoice).toHaveBeenCalledWith(RECORD_ID, 'INV2-XXXX', 40)
  })
})
