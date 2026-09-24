import { describe, expect, it, vi } from 'vitest'
import { PaypalClient } from '../../src/client/paypal.client.js'
import { CreateInvoiceDto } from '../../src/dto/create-invoice.dto.js'
import { InvoiceService } from '../../src/service/invoice.service.js'

describe('InvoiceService', () => {
  it('creates a PayPal invoice for the order', async () => {
    const paypalClient = { createInvoice: vi.fn().mockResolvedValue('INV2-XXXX') } as unknown as PaypalClient
    const invoiceService = new InvoiceService(paypalClient)

    const request = new CreateInvoiceDto()
    request.orderId = 1
    await invoiceService.createInvoice(request)

    expect(paypalClient.createInvoice).toHaveBeenCalled()
  })
})
