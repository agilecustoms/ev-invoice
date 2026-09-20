import serverlessExpress from '@codegenie/serverless-express'
import { NestFactory } from '@nestjs/core'
import { ExpressAdapter } from '@nestjs/platform-express'
import type { Context, APIGatewayProxyEventV2, APIGatewayProxyHandlerV2 } from 'aws-lambda'
import express from 'express'
import { LoggerErrorInterceptor } from 'nestjs-pino'
import { LambdaModule } from './lambda.module.js'

let proxyHandler: APIGatewayProxyHandlerV2

async function bootstrap(): Promise<APIGatewayProxyHandlerV2> {
  const expressApp = express()
  const app = await NestFactory.create(
    LambdaModule,
    new ExpressAdapter(expressApp),
    { bufferLogs: true }
  )
  // surprisingly, Nest does not produce any logs, so we do not need `app.useLogger(app.get(Logger))`
  app.useGlobalInterceptors(new LoggerErrorInterceptor()) // see https://github.com/iamolegga/nestjs-pino?tab=readme-ov-file#expose-stack-trace-and-error-class-in-err-property
  await app.init()

  // @ts-expect-error by design
  return serverlessExpress({ app: expressApp })
}

// noinspection JSUnusedGlobalSymbols
export const handler = async (event: APIGatewayProxyEventV2, context: Context) => {
  if (!proxyHandler) {
    proxyHandler = await bootstrap()
  }

  // need to enrich the logging context with requestId and agwRequestId,
  // but unfortunately, PinoLogger is not available here, so pass via headers
  event.headers['x-request-id'] = context.awsRequestId
  event.headers['x-agw-request-id'] = event.requestContext.requestId

  // event.rawPath is used to map request -> route
  // AWS Lambda API Gateway v2 includes "stage" name in the rawPath
  // plus we use multi-tenant AGW so each microservice has prefix = app-name,
  // so rawPath looks like /{stage}/{app-name}/{our-endpoint}
  // need to remove first two pieces so NestJS mapping works correctly
  const rawPath = event.rawPath
  let fixedPath = rawPath.substring(rawPath.indexOf('/', 1)) // strip stage
  fixedPath = fixedPath.substring(fixedPath.indexOf('/', 1)) // strip app-name
  event.rawPath = fixedPath

  // @ts-expect-error APIGatewayProxyHandlerV2 takes 3 parameters, but the 3rd is deprecated, just do not pass it
  return proxyHandler(event, context)
}
