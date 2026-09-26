import type { ConfigService } from '@nestjs/config'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PaypalClient, type PayPalCredentialsLoader } from '../../src/client/paypal.client.js'
import { CreateInvoiceDto } from '../../src/dto/create-invoice.dto.js'

const config = { getOrThrow: () => 'https://paypal.test' } as unknown as ConfigService

function request(): CreateInvoiceDto {
  const dto = new CreateInvoiceDto()
  dto.orderId = 1
  dto.orderPrice = 150
  dto.orderDeposit = 50
  return dto
}

const tokenResponse = () => Response.json({ access_token: 'token', expires_in: 3600 })
const invoiceResponse = () => Response.json({ href: 'https://paypal.test/v2/invoicing/invoices/INV2-1' })

describe('PaypalClient', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    fetchMock.mockReset()
  })

  it('does not load credentials until the first call, then caches them', async () => {
    const loadCredentials = vi.fn<PayPalCredentialsLoader>().mockResolvedValue({ clientId: 'id', clientSecret: 'secret' })
    const client = new PaypalClient(loadCredentials, config)
    expect(loadCredentials).not.toHaveBeenCalled()

    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(invoiceResponse())
    expect(await client.createInvoice(request())).toBe('INV2-1')
    fetchMock.mockResolvedValueOnce(invoiceResponse()) // token is cached as well
    await client.createInvoice(request())

    expect(loadCredentials).toHaveBeenCalledTimes(1)
  })

  it('does not cache a failed load', async () => {
    const loadCredentials = vi.fn<PayPalCredentialsLoader>()
      .mockRejectedValueOnce(new Error('Secrets Manager is down'))
      .mockResolvedValueOnce({ clientId: 'id', clientSecret: 'secret' })
    const client = new PaypalClient(loadCredentials, config)

    await expect(client.createInvoice(request())).rejects.toThrow('Secrets Manager is down')
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(invoiceResponse())
    expect(await client.createInvoice(request())).toBe('INV2-1')
  })
})
