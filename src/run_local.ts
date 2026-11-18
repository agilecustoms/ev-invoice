import { Module } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { Logger, LoggerModule } from 'nestjs-pino'
import { AppModule, init } from './app.module.js'
import { LocalCredentialsModule } from './local.module.js'

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: { // 'pino-http' comes as dependency of 'nestjs-pino'
        level: 'debug',
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
    LocalCredentialsModule,
    AppModule
  ]
})
class NestModule {}

/**
 * This entry point is for local development only. AWS uses lambda_handler.ts
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
