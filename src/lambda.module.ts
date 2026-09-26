import { Global, Module, type NestModule, type MiddlewareConsumer } from '@nestjs/common'
import { LoggerModule } from 'nestjs-pino'
import { destination, pino } from 'pino'
import { APP_NAME, AppModule } from './app.module.js'
import { PAYPAL_CREDENTIALS, type PayPalCredentials, type PayPalCredentialsLoader } from './client/paypal.client.js'
import { LoggerContextMiddleware } from './logger-context.middleware.js'
import { loadSecret } from './util/secrets.js'

const formatter = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  fractionalSecondDigits: 3,
  hour12: false,
})

/**
 * Single pino instance for both request-scoped and out-of-request logs (otherwise nestjs-pino creates two),
 * so lambda.ts can change the level of all of them at once
 */
export const logger = pino(
  {
    messageKey: 'message',
    errorKey: 'error',
    base: {
      service: APP_NAME,
      env: process.env['AWS_ENV']
    },
    redact: ['req'],
    formatters: {
      level: label => ({ level: label.toUpperCase() }),
      log: (object: Record<string, unknown>) => {
        return {
          ...object,
          ftime: formatter.format(object['time'] as number)
        }
      }
    }
  },
  destination({
    dest: 1, // stdout
    sync: true // synchronous writes less performant, but guarantee that all logs delivered in CloudWatch
  })
)

/**
 * AWS: PayPal credentials come from Secrets Manager (PAYPAL_SECRET_ID is set in infrastructure/lambda.tf).
 * Global, so PaypalClient in the shared AppModule can inject it (see local.ts for the local counterpart)
 */
@Global()
@Module({
  providers: [{
    provide: PAYPAL_CREDENTIALS,
    useValue: (() => loadSecret<PayPalCredentials>(process.env['PAYPAL_SECRET_ID']!)) satisfies PayPalCredentialsLoader
  }],
  exports: [PAYPAL_CREDENTIALS]
})
class CredentialsModule {
}

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: { // 'pino-http' comes as dependency of 'nestjs-pino'
        logger,
        autoLogging: false // do not log each request/response
      },
      renameContext: 'logger'
    }),
    CredentialsModule,
    AppModule
  ]
})
export class LambdaModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerContextMiddleware).forRoutes('*')
  }
}
