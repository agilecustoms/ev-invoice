import { BadRequestException, Controller, Get, type INestApplication, Module } from '@nestjs/common'
import { APP_FILTER, NestFactory } from '@nestjs/core'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AppExceptionFilter } from '../../src/exception/app-exception.filter.js'
import { BusinessException } from '../../src/exception/business.exception.js'

@Controller()
class ThrowingController {
  @Get('/business')
  business(): never {
    throw new BusinessException('invoice is already SENT')
  }

  @Get('/business-with-code')
  businessWithCode(): never {
    throw new BusinessException('invoice is already SENT', 'INVOICE_SENT')
  }

  @Get('/bad-request')
  badRequest(): never {
    throw new BadRequestException('recordId is malformed')
  }

  @Get('/unexpected')
  unexpected(): never {
    throw new Error('PayPal is down')
  }
}

// filter registered the same way as in AppModule
@Module({
  controllers: [ThrowingController],
  providers: [{ provide: APP_FILTER, useClass: AppExceptionFilter }]
})
class TestModule {}

describe('AppExceptionFilter', () => {
  let app: INestApplication
  let baseUrl: string

  beforeAll(async () => {
    app = await NestFactory.create(TestModule, { logger: false })
    await app.listen(0)
    baseUrl = await app.getUrl()
  })

  afterAll(async () => {
    await app.close()
  })

  async function get(path: string): Promise<{ status: number, body: unknown }> {
    const response = await fetch(baseUrl + path)
    return { status: response.status, body: await response.json() }
  }

  it('turns BusinessException into 422', async () => {
    expect(await get('/business')).toEqual({
      status: 422,
      body: { statusCode: 422, message: 'invoice is already SENT', error: 'Unprocessable Entity' }
    })
  })

  it('puts BusinessException code in errorCode', async () => {
    expect(await get('/business-with-code')).toEqual({
      status: 422,
      body: { statusCode: 422, message: 'invoice is already SENT', error: 'Unprocessable Entity', errorCode: 'INVOICE_SENT' }
    })
  })

  it('keeps Nest default handling for HttpException', async () => {
    expect(await get('/bad-request')).toEqual({
      status: 400,
      body: { statusCode: 400, message: 'recordId is malformed', error: 'Bad Request' }
    })
  })

  it('does not expose details of an unexpected error', async () => {
    expect(await get('/unexpected')).toEqual({
      status: 500,
      body: { statusCode: 500, message: 'Internal server error' }
    })
  })
})
