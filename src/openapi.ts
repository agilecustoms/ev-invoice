import { writeFileSync } from 'node:fs'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { LambdaModule } from './lambda.module.js'

const APP_NAME = 'ev-invoice'

const app = await NestFactory.create(LambdaModule)
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
      $ref: `#/components/x-amazon-apigateway-integrations/${APP_NAME}`
    }
  })
})
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const components = document.components as any
components['x-amazon-apigateway-integrations'] = {
  [APP_NAME]: {
    type: 'aws_proxy',
    payloadFormatVersion: '2.0', // tied to a library used as adapter between AGW and Lambda: import { APIGatewayProxyEvent } from 'aws-lambda'
    uri: '${FUNCTION_ARN}',
    httpMethod: 'POST'
  }
}

writeFileSync('./dist/openapi.json', JSON.stringify(document))
