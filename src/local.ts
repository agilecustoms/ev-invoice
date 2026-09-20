import { Module } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { Logger, LoggerModule } from 'nestjs-pino'
import { AppModule } from '././invoice/app.module.js'

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
    AppModule
  ]
})
class LocalModule {}

/**
 * This entry point is for local development only. AWS uses lambda.ts
 */
async function bootstrap() {
  const app = await NestFactory.create(LocalModule, { bufferLogs: true })
  app.useLogger(app.get(Logger))
  app.enableCors() // use only for local development. In AWS, Api Gateway handles CORS
  await app.listen(3000)
}
// noinspection JSIgnoredPromiseFromCall
bootstrap()
