import { Global, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { Logger, LoggerModule } from 'nestjs-pino'
import { AppModule, init } from './app.module.js'
import { PAYPAL_CREDENTIALS, type PayPalCredentials } from './client/paypal.client.js'

/**
 * Credentials come from .env.local via ConfigService (no AWS calls, see lambda.module.ts for AWS counterpart).
 * @Global, so PaypalClient in the shared AppModule can inject it
 */
@Global()
@Module({
  providers: [{
    provide: PAYPAL_CREDENTIALS,
    useFactory: (config: ConfigService): PayPalCredentials => ({
      clientId: config.getOrThrow<string>('PAYPAL_CLIENT_ID'),
      clientSecret: config.getOrThrow<string>('PAYPAL_CLIENT_SECRET')
    }),
    inject: [ConfigService]
  }],
  exports: [PAYPAL_CREDENTIALS]
})
class CredentialsModule {}

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: { // 'pino-http' comes as dependency of 'nestjs-pino'
        autoLogging: false, // do not log each request/response
        redact: ['req'],
        transport: {
          target: 'pino-pretty',
          options: {
            singleLine: true,
            messageFormat: '{context} - {msg}',
            ignore: 'req,pid,hostname,context'
          }
        }
      }
    }),
    CredentialsModule,
    AppModule
  ]
})
class NestModule {}

/**
 * This entry point is for local development only. AWS uses lambda.ts
 */
async function bootstrap() {
  const app = await NestFactory.create(NestModule, { bufferLogs: true })
  init(app)
  app.useLogger(app.get(Logger))
  app.enableCors() // use only for local development. In AWS, Api Gateway handles CORS
  await app.listen(3000)
}
// noinspection JSIgnoredPromiseFromCall
bootstrap()
