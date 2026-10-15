import { type INestApplication, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { APP_FILTER, NestFactory } from '@nestjs/core'
import { LoggerModule } from 'nestjs-pino'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { init } from '../../src/app.module.js'
import { AirTableClient } from '../../src/client/airtable.client.js'
import { PaypalClient } from '../../src/client/paypal.client.js'
import { ScheduleClient } from '../../src/client/schedule.client.js'
import { InvoiceController } from '../../src/controller/invoice.controller.js'
import { AppExceptionFilter } from '../../src/exception/app-exception.filter.js'
import { InvoiceService } from '../../src/service/invoice.service.js'

/**
 * HTTP level: real controller, service, ValidationPipe (from init) and exception filter; clients are never called
 */
@Module({
  imports: [LoggerModule.forRoot({ pinoHttp: { level: 'silent' } })],
  controllers: [InvoiceController],
  providers: [
    InvoiceService,
    { provide: ConfigService, useValue: { getOrThrow: () => 'PT24H' } },
    { provide: PaypalClient, useValue: {} },
    { provide: AirTableClient, useValue: {} },
    { provide: ScheduleClient, useValue: {} },
    { provide: APP_FILTER, useClass: AppExceptionFilter }
  ]
})
class TestModule {}

describe('POST /invoice/preview', () => {
  let app: INestApplication
  let url: string

  beforeAll(async () => {
    app = await NestFactory.create(TestModule, { logger: false })
    init(app)
    await app.listen(0)
    url = `${await app.getUrl()}/invoice/preview`
  })

  afterAll(async () => {
    await app.close()
  })

  async function post(body: object): Promise<{ status: number, body: Record<string, unknown> }> {
    const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    return { status: response.status, body: await response.json() as Record<string, unknown> }
  }

  it('returns 200 with the invoice preview', async () => {
    const { status, body } = await post({ type: 'Bridal', serviceDate: '2099-11-21', price: 650, services: 'Bridal Makeup' })

    expect(status).toBe(200)
    expect(body).toMatchObject({ total: 650, deposit: 130, defaultDeposit: true, balance: 520, balanceDueDate: '2099-11-21' })
  })

  it('returns 400 for a malformed body', async () => {
    const { status, body } = await post({ type: 'Haircut', serviceDate: 'tomorrow', price: -1 })

    expect(status).toBe(400)
    expect(body['message']).toEqual(expect.arrayContaining([
      expect.stringMatching(/type/), expect.stringMatching(/serviceDate/), expect.stringMatching(/price/)
    ]))
  })

  it('returns 422 when the booking breaks a business rule', async () => {
    const { status, body } = await post({ type: 'Special Occasion', serviceDate: '2099-11-21', price: 100, deposit: 150 })

    expect(status).toBe(422)
    expect(body).toEqual({ statusCode: 422, message: 'deposit must not exceed price', error: 'Unprocessable Entity' })
  })
})
