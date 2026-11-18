import { type INestApplication, Module, ValidationPipe } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core'
import { AirTableClient } from './client/airtable.client.js'
import { PaypalClient } from './client/paypal.client.js'
import { ScheduleClient } from './client/schedule.client.js'
import { loadConfig } from './config/config.js'
import { HealthController } from './controller/health.controller.js'
import { InvoiceController } from './controller/invoice.controller.js'
import { RouteLogInterceptor } from './controller/route-log.interceptor.js'
import { SqsController } from './controller/sqs.controller.js'
import { AppExceptionFilter } from './exception/app-exception.filter.js'
import { InvoiceService } from './service/invoice.service.js'

export const APP_NAME = 'ev-invoice'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true, // config/.env files are read by config.ts, see README
      load: [loadConfig]
    })
  ],
  controllers: [
    HealthController,
    InvoiceController
  ],
  providers: [
    InvoiceService, PaypalClient, AirTableClient, ScheduleClient, SqsController,
    // global exception filter and interceptor via DI (not app.useGlobal*) so they apply in every entry point
    { provide: APP_FILTER, useClass: AppExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: RouteLogInterceptor }
  ]
})
export class AppModule {}

/**
 * Initialization code common for both Lambda and local development
 */
export function init(app: INestApplication): void {
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    })
  )
}
