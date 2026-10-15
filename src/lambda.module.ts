import { getCurrentInvoke } from '@codegenie/serverless-express'
import { Global, Module } from '@nestjs/common'
import type { APIGatewayProxyEvent, APIGatewayProxyEventV2, Context } from 'aws-lambda'
import { LoggerModule } from 'nestjs-pino'
import { destination, pino } from 'pino'
import { AppModule } from './app.module.js'
import { AIRTABLE_CREDENTIALS, type AirTableCredentialsLoader } from './client/airtable.client.js'
import { PAYPAL_CREDENTIALS, type PayPalCredentials, type PayPalCredentialsLoader } from './client/paypal.client.js'
import { loadPlainSecret, loadSecret } from './util/secrets.js'

const formatter = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  fractionalSecondDigits: 3,
  hour12: false,
})

/**
 * pino puts the time in the log line as a raw JSON fragment (it is not part of the object seen by formatters.log),
 * so emit both time keys here from a single clock reading:
 * - 'timestamp': µs since epoch, to sort by
 * - 'ftime': human-readable time (no date), helpful to read logs in CloudWatch console
 */
function timestamp(): string {
  // Date.now() is only millisecond precision, so use performance.now() to get microseconds
  const micros = Math.floor((performance.timeOrigin + performance.now()) * 1000)
  return `,"timestamp":${micros},"ftime":"${formatter.format(Math.floor(micros / 1000))}"`
}

/**
 * Single pino instance for both request-scoped and out-of-request logs (otherwise nestjs-pino creates two),
 * so lambda.ts can change the level of all of them at once
 */
export const logger = pino(
  {
    messageKey: 'message',
    errorKey: 'error',
    base: {
      service: 'invoice', // app name w/o project prefix (ev-invoice -> invoice)
      env: process.env['AWS_ENV']
    },
    redact: ['req'],
    timestamp,
    formatters: {
      level: label => ({ level: label.toUpperCase() })
    }
  },
  destination({
    dest: 1, // stdout
    sync: true // synchronous writes less performant, but guarantee that all logs delivered in CloudWatch
  })
)

/**
 * Capture the current AWS request id and API Gateway request id and put them in every log record - once per request
 */
function getRequestIds(): object {
  const { event, context } = getCurrentInvoke() as {
    event: APIGatewayProxyEvent | APIGatewayProxyEventV2
    context: Context
  }
  return {
    requestId: context.awsRequestId,
    agwRequestId: event.requestContext.requestId
  }
}

/**
 * AWS: PayPal and AirTable credentials come from Secrets Manager (PAYPAL_SECRET_ID / AIRTABLE_SECRET_ID are set in
 * infrastructure/lambda.tf). Global, so PaypalClient/AirTableClient in the shared AppModule can inject them
 * (see local.ts for the local counterpart)
 */
@Global()
@Module({
  providers: [
    {
      provide: PAYPAL_CREDENTIALS,
      useValue: (() => loadSecret<PayPalCredentials>(process.env['PAYPAL_SECRET_ID']!)) satisfies PayPalCredentialsLoader
    },
    {
      provide: AIRTABLE_CREDENTIALS,
      useValue: (() => loadPlainSecret(process.env['AIRTABLE_SECRET_ID']!)) satisfies AirTableCredentialsLoader
    }
  ],
  exports: [PAYPAL_CREDENTIALS, AIRTABLE_CREDENTIALS]
})
class CredentialsModule {
}

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: { // 'pino-http' comes as dependency of 'nestjs-pino'
        logger,
        autoLogging: false, // do not log each request/response
        customProps: getRequestIds
      },
      renameContext: 'logger'
    }),
    CredentialsModule,
    AppModule
  ]
})
export class LambdaModule {
}
