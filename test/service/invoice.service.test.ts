import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it, vi } from 'vitest'
import { PaypalClient } from '../../src/client/paypal.client.js'
import { CreateInvoiceDto, OrderStatus, OrderType } from '../../src/dto/create-invoice.dto.js'
import { InvoiceService } from '../../src/service/invoice.service.js'

function validRequest(): CreateInvoiceDto {
  const request = new CreateInvoiceDto()
  request.orderId = 1
  request.orderType = OrderType.BRIDAL
  request.orderStatus = OrderStatus.CONFIRMED
  request.orderServiceDate = Temporal.Now.plainDateISO('UTC').add({ days: 1 })
  request.orderServices = 'Bridal Makeup'
  return request
}

describe('InvoiceService', () => {
  it('creates a PayPal invoice for the order', async () => {
    const paypalClient = { createInvoice: vi.fn().mockResolvedValue('INV2-XXXX') } as unknown as PaypalClient
    const invoiceService = new InvoiceService(paypalClient)

    await invoiceService.createInvoice(validRequest())

    expect(paypalClient.createInvoice).toHaveBeenCalled()
  })

  it('rejects an order status that is not invoiceable', async () => {
    const paypalClient = { createInvoice: vi.fn() } as unknown as PaypalClient
    const invoiceService = new InvoiceService(paypalClient)
    const request = validRequest()
    request.orderStatus = OrderStatus.DONE

    await expect(invoiceService.createInvoice(request)).rejects.toThrow(/orderStatus/)
    expect(paypalClient.createInvoice).not.toHaveBeenCalled()
  })

  it('rejects a service date that is not in the future', async () => {
    const paypalClient = { createInvoice: vi.fn() } as unknown as PaypalClient
    const invoiceService = new InvoiceService(paypalClient)
    const request = validRequest()
    request.orderServiceDate = Temporal.Now.plainDateISO('UTC')

    await expect(invoiceService.createInvoice(request)).rejects.toThrow(/future/)
    expect(paypalClient.createInvoice).not.toHaveBeenCalled()
  })

  it('rejects an empty orderServices for a Bridal order', async () => {
    const paypalClient = { createInvoice: vi.fn() } as unknown as PaypalClient
    const invoiceService = new InvoiceService(paypalClient)
    const request = validRequest()
    request.orderServices = '  '

    await expect(invoiceService.createInvoice(request)).rejects.toThrow(/orderServices/)
    expect(paypalClient.createInvoice).not.toHaveBeenCalled()
  })
})
