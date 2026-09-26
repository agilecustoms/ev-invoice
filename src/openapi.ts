import { writeFileSync } from 'node:fs'
import { Global, Module } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { LoggerModule } from 'nestjs-pino'
import { AppModule } from './app.module.js'
import { PAYPAL_CREDENTIALS, type PayPalCredentialsLoader } from './client/paypal.client.js'

const APP_NAME = 'ev-invoice'

/**
 * The spec is generated from controllers, but the whole app has to start. Credentials are loaded lazily, so they are
 * never needed here (and in CI there is no access to Secrets Manager). See lambda.module.ts and local.ts for real ones
 */
@Global()
@Module({
  providers: [{
    provide: PAYPAL_CREDENTIALS,
    useValue: (() => Promise.reject(new Error('PayPal credentials are not available in OpenAPI generation'))) satisfies PayPalCredentialsLoader
  }],
  exports: [PAYPAL_CREDENTIALS]
})
class CredentialsModule {}

@Module({
  imports: [LoggerModule.forRoot(), CredentialsModule, AppModule]
})
class NestModule {}

const app = await NestFactory.create(NestModule)
app.setGlobalPrefix(APP_NAME) // to allow multiple services under the same AGW / domain

const config = new DocumentBuilder()
  .setTitle('API Docs')
  .setDescription('API description')
  .setVersion('1.0')
  .build()
const document = SwaggerModule.createDocument(app, config)

Object.values(document.paths).forEach((methods) => {
  Object.values(methods).forEach((method) => {
    method['x-amazon-apigateway-integration'] = {
      type: 'aws_proxy',
      httpMethod: 'POST',
      uri: '${INVOKE_ARN}'
    }
  })
})

writeFileSync('./dist/openapi.json', JSON.stringify(document))
