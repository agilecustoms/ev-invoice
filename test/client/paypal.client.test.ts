import { Temporal } from '@js-temporal/polyfill'
import type { ConfigService } from '@nestjs/config'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PaypalClient, type PayPalCredentialsLoader } from '../../src/client/paypal.client.js'
import { OrderDto } from '../../src/dto/order.dto.js'

const CONFIG: Record<string, string> = {
  PAYPAL_URL: 'https://paypal.test',
  PAYPAL_INVOICER_EMAIL: 'invoicer@example.com',
}
const TERM = Temporal.Duration.from('PT24H')
const config = { getOrThrow: (key: string) => CONFIG[key] } as unknown as ConfigService

function request(): OrderDto {
  const dto = new OrderDto()
  dto.recordId = 'recDkcV8BUDP5kfkX'
  dto.id = 1
  dto.price = 150
  dto.deposit = 50
  dto.serviceDate = Temporal.PlainDate.from('2026-10-04')
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
    expect(await client.createInvoice(request(), TERM)).toBe('INV2-1')
    fetchMock.mockResolvedValueOnce(invoiceResponse()) // token is cached as well
    await client.createInvoice(request(), TERM)

    expect(loadCredentials).toHaveBeenCalledTimes(1)
  })

  it('does not cache a failed load', async () => {
    loadCredentials.mockReset()
      .mockRejectedValueOnce(new Error('Secrets Manager is down'))
      .mockResolvedValueOnce({ clientId: 'id', clientSecret: 'secret' })

    await expect(client.createInvoice(request(), TERM)).rejects.toThrow('Secrets Manager is down')
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(invoiceResponse())
    expect(await client.createInvoice(request(), TERM)).toBe('INV2-1')
  })

  it('formats the service date for the due date and description', async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(invoiceResponse())

    await client.createInvoice(request(), TERM)

    const [, invoiceCall] = fetchMock.mock.calls
    const body = JSON.parse(invoiceCall![1]?.body as string)
    expect(body.detail.payment_term.due_date).toBe('2026-10-04')
    expect(body.detail.reference).toBe('recDkcV8BUDP5kfkX')
    expect(body.items[0].description).toContain('Date: Oct 4, 2026')
  })

  it.each(['+12035700477', '2035700477', '(203) 570-0477', '+1 203-570-0477'])(
    'sends phone %s as country code + digits-only national number', async (customerPhone) => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(invoiceResponse())

      const dto = request()
      dto.customerPhone = customerPhone
      await client.createInvoice(dto, TERM)

      const [, invoiceCall] = fetchMock.mock.calls
      const body = JSON.parse(invoiceCall![1]?.body as string)
      expect(body.primary_recipients[0].billing_info.phones[0]).toEqual(
        { country_code: '1', national_number: '2035700477', phone_type: 'MOBILE' })
    })

  it('sends the configured invoicer email', async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(invoiceResponse())

    await client.createInvoice(request(), TERM)

    const [, invoiceCall] = fetchMock.mock.calls
    const body = JSON.parse(invoiceCall![1]?.body as string)
    expect(body.invoicer.email_address).toBe('invoicer@example.com')
  })

  it('states the deposit term in the note and payment terms', async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(invoiceResponse())

    await client.createInvoice(request(), Temporal.Duration.from('PT10M'))

    const [, invoiceCall] = fetchMock.mock.calls
    const body = JSON.parse(invoiceCall![1]?.body as string)
    expect(body.detail.note).toContain('deposit due in 10 minutes')
    expect(body.detail.payment_terms).toContain('within 10 minutes')
  })

  it('omits partial payment terms when no deposit is required', async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(invoiceResponse())

    const dto = request()
    dto.deposit = undefined
    await client.createInvoice(dto, TERM)

    const [, invoiceCall] = fetchMock.mock.calls
    const body = JSON.parse(invoiceCall![1]?.body as string)
    expect(body.configuration.partial_payment).toBeUndefined()
    expect(body.detail.note).toBe('Balance due on service date')
  })

  it('omits venue address and services from the description when not supplied', async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(invoiceResponse())

    const dto = request()
    dto.address = undefined
    dto.services = undefined
    await client.createInvoice(dto, TERM)

    const [, invoiceCall] = fetchMock.mock.calls
    const body = JSON.parse(invoiceCall![1]?.body as string)
    expect(body.items[0].description).not.toContain('Venue address')
    expect(body.items[0].description).not.toContain('Services')
  })

  it('sends the invoice', async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(Response.json({}))

    await client.sendInvoice('INV2-1')

    const [, sendCall] = fetchMock.mock.calls
    expect(sendCall![0]).toBe('https://paypal.test/v2/invoicing/invoices/INV2-1/send')
    expect(sendCall![1]?.method).toBe('POST')
  })

  it('throws when sending fails', async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(new Response('{}', { status: 422 }))

    await expect(client.sendInvoice('INV2-1')).rejects.toThrow(/send failed: 422/)
  })

  it('gets the invoice status', async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(Response.json({ id: 'INV2-1', status: 'PAID' }))

    expect(await client.getInvoiceStatus('INV2-1')).toBe('PAID')

    const [, getCall] = fetchMock.mock.calls
    expect(getCall![0]).toBe('https://paypal.test/v2/invoicing/invoices/INV2-1')
    expect(getCall![1]?.method).toBe('GET')
    expect(getCall![1]?.body).toBeUndefined()
  })

  it('finds an invoice by reference', async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(Response.json({
      items: [{ id: 'INV2-1', status: 'DRAFT' }]
    }))

    expect(await client.findInvoiceByReference('recDkcV8BUDP5kfkX')).toEqual({ id: 'INV2-1', status: 'DRAFT' })

    const [, searchCall] = fetchMock.mock.calls
    expect(searchCall![0]).toBe('https://paypal.test/v2/invoicing/search-invoices')
    expect(searchCall![1]?.method).toBe('POST')
    expect(JSON.parse(searchCall![1]?.body as string)).toEqual({ reference: 'recDkcV8BUDP5kfkX' })
  })

  it('returns undefined when no invoice matches the reference', async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(Response.json({ items: [] }))

    expect(await client.findInvoiceByReference('recDkcV8BUDP5kfkX')).toBeUndefined()
  })

  it('deletes an invoice', async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(new Response(null, { status: 204 }))

    await client.deleteInvoice('INV2-1')

    const [, deleteCall] = fetchMock.mock.calls
    expect(deleteCall![0]).toBe('https://paypal.test/v2/invoicing/invoices/INV2-1')
    expect(deleteCall![1]?.method).toBe('DELETE')
  })
})
