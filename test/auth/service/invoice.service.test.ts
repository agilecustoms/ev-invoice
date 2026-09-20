import { describe, it } from 'vitest'
import { InvoiceService } from '../../../src/auth/service/invoice.service.js'

describe('InvoiceService', () => {

  const invoiceService = new InvoiceService()

  it('should be defined', () => {
    invoiceService.generateInvoice()
  })
})
