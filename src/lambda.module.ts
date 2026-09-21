import { Global, Module, type NestModule, type MiddlewareConsumer } from '@nestjs/common'
import { LoggerModule } from 'nestjs-pino'
import { AppModule } from './invoice/app.module.js'
import { PAYPAL_CREDENTIALS, type PayPalCredentials } from './invoice/client/paypal.client.js'
import { loadSecret } from './invoice/util/secrets.js'
import { LoggerContextMiddleware } from './LoggerContextMiddleware.js'

const formatter = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  fractionalSecondDigits: 3,
  hour12: false,
})

/**
 * AWS: PayPal credentials come from Secrets Manager (PAYPAL_SECRET_ID is set in infrastructure/lambda.tf).
 * Global, so PaypalClient in the shared AppModule can inject it (see local.ts for the local counterpart)
 */
@Global()
@Module({
  providers: [{
    provide: PAYPAL_CREDENTIALS,
    useFactory: (): Promise<PayPalCredentials> => loadSecret<PayPalCredentials>(process.env['PAYPAL_SECRET_ID']!)
  }],
  exports: [PAYPAL_CREDENTIALS]
})
class CredentialsModule {}

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: { // 'pino-http' comes as dependency of 'nestjs-pino'
        autoLogging: false, // do not log each request/response
        messageKey: 'message',
        base: {
          service: 'ev-invoice',
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
