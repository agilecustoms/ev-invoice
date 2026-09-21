import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PaypalClient } from './client/paypal.client.js'
import { HealthController } from './controller/health.controller.js'
import { InvoiceController } from './controller/invoice.controller.js'
import { InvoiceService } from './service/invoice.service.js'

const profile = process.env['APP_PROFILE']

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
  providers: [InvoiceService, PaypalClient]
})
export class AppModule {}
