import { type INestApplication, Module, ValidationPipe } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER } from '@nestjs/core'
import { AirTableClient } from './client/airtable.client.js'
import { PaypalClient } from './client/paypal.client.js'
import { ScheduleClient } from './client/schedule.client.js'
import { HealthController } from './controller/health.controller.js'
import { InvoiceController } from './controller/invoice.controller.js'
import { SqsController } from './controller/sqs.controller.js'
import { AppExceptionFilter } from './exception/app-exception.filter.js'
import { InvoiceService } from './service/invoice.service.js'

export const APP_NAME = 'ev-invoice'

const profile = process.env['APP_PROFILE'] ?? 'prod'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`.env.${profile}`]
    })
  ],
  controllers: [
    HealthController,
    InvoiceController
  ],
  providers: [
    InvoiceService, PaypalClient, AirTableClient, ScheduleClient, SqsController,
    // global exception filter via DI (not app.useGlobalFilters) so it applies in every entry point: lambda.ts and local.ts
    { provide: APP_FILTER, useClass: AppExceptionFilter }
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
