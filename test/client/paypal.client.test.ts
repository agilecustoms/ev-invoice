import { Temporal } from '@js-temporal/polyfill'
import type { ConfigService } from '@nestjs/config'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PaypalClient, type PayPalCredentialsLoader } from '../../src/client/paypal.client.js'
import { OrderDto } from '../../src/dto/order.dto.js'

const config = { getOrThrow: () => 'https://paypal.test' } as unknown as ConfigService

function request(): OrderDto {
  const dto = new OrderDto()
  dto.orderId = 1
  dto.orderPrice = 150
  dto.orderDeposit = 50
  dto.orderServiceDate = Temporal.PlainDate.from('2026-10-04')
  dto.customerPhone = '2035700477'
  return dto
}

const tokenResponse = () => Response.json({ access_token: 'token', expires_in: 3600 })
const invoiceResponse = () => Response.json({ href: 'https://paypal.test/v2/invoicing/invoices/INV2-1' })

describe('PaypalClient', () => {
  const fetchMock = vi.fn<typeof fetch>()
  let loadCredentials: ReturnType<typeof vi.fn<PayPalCredentialsLoader>>
  let client: PaypalClient

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    loadCredentials = vi.fn<PayPalCredentialsLoader>().mockResolvedValue({ clientId: 'id', clientSecret: 'secret' })
    client = new PaypalClient(loadCredentials, config)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    fetchMock.mockReset()
  })

  it('does not load credentials until the first call, then caches them', async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(invoiceResponse())
    expect(await client.createInvoice(request())).toBe('INV2-1')
    fetchMock.mockResolvedValueOnce(invoiceResponse()) // token is cached as well
    await client.createInvoice(request())

    expect(loadCredentials).toHaveBeenCalledTimes(1)
  })

  it('does not cache a failed load', async () => {
    loadCredentials.mockReset()
      .mockRejectedValueOnce(new Error('Secrets Manager is down'))
      .mockResolvedValueOnce({ clientId: 'id', clientSecret: 'secret' })

    await expect(client.createInvoice(request())).rejects.toThrow('Secrets Manager is down')
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(invoiceResponse())
    expect(await client.createInvoice(request())).toBe('INV2-1')
  })

  it('formats the service date for the due date and description', async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(invoiceResponse())

    await client.createInvoice(request())

    const [, invoiceCall] = fetchMock.mock.calls
    const body = JSON.parse(invoiceCall![1]?.body as string)
    expect(body.detail.payment_term.due_date).toBe('2026-10-04')
    expect(body.items[0].description).toContain('Date: Oct 4, 2026')
  })

  it.each(['+12035700477', '2035700477', '(203) 570-0477', '+1 203-570-0477'])(
    'sends phone %s as country code + digits-only national number', async (customerPhone) => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(invoiceResponse())

      const dto = request()
      dto.customerPhone = customerPhone
      await client.createInvoice(dto)

      const [, invoiceCall] = fetchMock.mock.calls
      const body = JSON.parse(invoiceCall![1]?.body as string)
      expect(body.primary_recipients[0].billing_info.phones[0]).toEqual(
        { country_code: '1', national_number: '2035700477', phone_type: 'MOBILE' })
    })

  it('omits partial payment terms when no deposit is required', async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(invoiceResponse())

    const dto = request()
    dto.orderDeposit = undefined
    await client.createInvoice(dto)

    const [, invoiceCall] = fetchMock.mock.calls
    const body = JSON.parse(invoiceCall![1]?.body as string)
    expect(body.configuration.partial_payment).toBeUndefined()
    expect(body.detail.note).toBe('Balance due on service date')
  })

  it('omits venue address and services from the description when not supplied', async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(invoiceResponse())

    const dto = request()
    dto.orderAddress = undefined
    dto.orderServices = undefined
    await client.createInvoice(dto)

    const [, invoiceCall] = fetchMock.mock.calls
    const body = JSON.parse(invoiceCall![1]?.body as string)
    expect(body.items[0].description).not.toContain('Venue address')
    expect(body.items[0].description).not.toContain('Services')
  })
})
