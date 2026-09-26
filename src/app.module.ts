import { type INestApplication, Module, ValidationPipe } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AirTableClient } from './client/airtable.client.js'
import { PaypalClient } from './client/paypal.client.js'
import { HealthController } from './controller/health.controller.js'
import { InvoiceController } from './controller/invoice.controller.js'
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
  providers: [InvoiceService, PaypalClient, AirTableClient]
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
