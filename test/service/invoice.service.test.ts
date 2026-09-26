import { Temporal } from '@js-temporal/polyfill'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
  let paypalClient: PaypalClient
  let invoiceService: InvoiceService

  beforeEach(() => {
    paypalClient = { createInvoice: vi.fn() } as unknown as PaypalClient
    invoiceService = new InvoiceService(paypalClient)
  })

  it('rejects an order status that is not invoiceable', async () => {
    const request = validRequest()
    request.orderStatus = OrderStatus.DONE

    await expect(invoiceService.createInvoice(request)).rejects.toThrow(/status/)
    expect(paypalClient.createInvoice).not.toHaveBeenCalled()
  })

  it('rejects a service date that is not in the future', async () => {
    const request = validRequest()
    request.orderServiceDate = Temporal.Now.plainDateISO('UTC')

    await expect(invoiceService.createInvoice(request)).rejects.toThrow(/future/)
    expect(paypalClient.createInvoice).not.toHaveBeenCalled()
  })

  it('rejects an empty orderServices for a Bridal order', async () => {
    const request = validRequest()
    request.orderServices = '  '

    await expect(invoiceService.createInvoice(request)).rejects.toThrow(/services/)
    expect(paypalClient.createInvoice).not.toHaveBeenCalled()
  })

  it('rejects a deposit that exceeds the price', async () => {
    const request = validRequest()
    request.orderPrice = 100
    request.orderDeposit = 150

    await expect(invoiceService.createInvoice(request)).rejects.toThrow(/deposit/)
    expect(paypalClient.createInvoice).not.toHaveBeenCalled()
  })

  it('defaults the deposit to 20% of the price, rounded up to the nearest $10', async () => {
    vi.mocked(paypalClient.createInvoice).mockResolvedValue('INV2-XXXX')
    const request = validRequest()
    request.orderPrice = 155

    await invoiceService.createInvoice(request)

    expect(paypalClient.createInvoice).toHaveBeenCalledWith(expect.objectContaining({ orderDeposit: 40 }))
  })

  it('creates a PayPal invoice for the order', async () => {
    vi.mocked(paypalClient.createInvoice).mockResolvedValue('INV2-XXXX')

    await invoiceService.createInvoice(validRequest())

    expect(paypalClient.createInvoice).toHaveBeenCalled()
  })
})
