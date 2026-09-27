import { Temporal } from '@js-temporal/polyfill'
import type { ConfigService } from '@nestjs/config'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AirTableClient } from '../../src/client/airtable.client.js'
import { OrderDto } from '../../src/dto/order.dto.js'

const config = { getOrThrow: () => 'appTEST' } as unknown as ConfigService
const RECORD_ID = 'recDkcV8BUDP5kfkX'
const RECORD_URL = `https://api.airtable.com/v0/appTEST/Orders/${RECORD_ID}`

describe('AirTableClient', () => {
  const fetchMock = vi.fn<typeof fetch>()
  let client: AirTableClient

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    client = new AirTableClient(() => Promise.resolve('token'), config)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    fetchMock.mockReset()
  })

  it('loads the order and maps AirTable fields to OrderDto', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({
      id: RECORD_ID,
      fields: {
        ID: 110,
        Type: 'Bridal',
        Status: 'Confirmed',
        Name: 'Jane Doe',
        email: 'jane@example.com',
        Phone: '(203) 570-0477',
        Price: 500,
        Address: '1 Main St',
        Date: '2026-10-04',
        Time: '2:00pm',
        Services: 'Bridal Makeup',
      }
    }))

    const order = await client.getOrder(RECORD_ID)

    expect(fetchMock).toHaveBeenCalledWith(RECORD_URL, expect.objectContaining({ method: 'GET' }))
    expect(order).toBeInstanceOf(OrderDto)
    expect(order).toMatchObject({
      recordId: RECORD_ID,
      id: 110,
      type: 'Bridal',
      status: 'Confirmed',
      customerName: 'Jane Doe',
      customerEmail: 'jane@example.com',
      customerPhone: '(203) 570-0477',
      price: 500,
      deposit: undefined, // empty fields are omitted by AirTable
      address: '1 Main St',
      completionTime: '2:00pm',
      services: 'Bridal Makeup',
    })
    expect(order.serviceDate).toEqual(Temporal.PlainDate.from('2026-10-04'))
  })

  it('saves invoice id, deposit and invoice status', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({}))

    await client.saveInvoice(RECORD_ID, 'INV2-XXXX', 40)

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe(RECORD_URL)
    expect(init?.method).toBe('PATCH')
    expect(JSON.parse(init?.body as string)).toEqual({
      fields: { 'invoiceId': 'INV2-XXXX', 'Deposit': 40, 'Invoice Status': 'Sent' }
    })
  })

  it('throws on a failed request', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"error":"NOT_FOUND"}', { status: 404 }))

    await expect(client.getOrder(RECORD_ID)).rejects.toThrow(/404/)
  })
})
