import { describe, expect, it, vi } from 'vitest'
import { PaypalClient } from '../../src/client/paypal.client.js'
import { InvoiceService } from '../../src/service/invoice.service.js'

describe('InvoiceService', () => {
  it('creates a PayPal invoice for the order', async () => {
    const paypalClient = { createInvoice: vi.fn().mockResolvedValue('INV2-XXXX') } as unknown as PaypalClient
    const invoiceService = new InvoiceService(paypalClient)

    await invoiceService.createInvoice(1)

    expect(paypalClient.createInvoice).toHaveBeenCalledWith(
      { name: 'John Doe', email: 'john.doe@example.com' },
      10,
      'Order 1'
    )
  })
})
