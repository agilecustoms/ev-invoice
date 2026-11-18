import { Global, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AIRTABLE_CREDENTIALS, type AirTableCredentialsLoader } from './client/airtable.client.js'
import { PAYPAL_CREDENTIALS, type PayPalCredentialsLoader } from './client/paypal.client.js'

/**
 * Local entry point (run_local.ts): credentials come from config/.env.localaws via ConfigService,
 * no Secrets Manager calls (see lambda.module.ts for AWS counterpart).
 * @Global, so PaypalClient/AirTableClient in the shared AppModule can inject them
 */
@Global()
@Module({
  providers: [
    {
      provide: PAYPAL_CREDENTIALS,
      useFactory: (config: ConfigService): PayPalCredentialsLoader => () => Promise.resolve({
        clientId: config.getOrThrow<string>('PAYPAL_CLIENT_ID'),
        clientSecret: config.getOrThrow<string>('PAYPAL_CLIENT_SECRET')
      }),
      inject: [ConfigService]
    },
    {
      provide: AIRTABLE_CREDENTIALS,
      useFactory: (config: ConfigService): AirTableCredentialsLoader => () => Promise.resolve(config.getOrThrow<string>('AIRTABLE_API_TOKEN')),
      inject: [ConfigService]
    }
  ],
  exports: [PAYPAL_CREDENTIALS, AIRTABLE_CREDENTIALS]
})
export class LocalCredentialsModule {}
