import serverlessExpress from '@codegenie/serverless-express'
import { NestFactory } from '@nestjs/core'
import { ExpressAdapter } from '@nestjs/platform-express'
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyEventV2,
  APIGatewayProxyResult,
  APIGatewayProxyStructuredResultV2,
  Context
} from 'aws-lambda'
import express from 'express'
import { Logger, LoggerErrorInterceptor } from 'nestjs-pino'
import { init } from './app.module.js'
import { LambdaModule, logger } from './lambda.module.js'

// REST API sends payload format 1.0, HTTP API (and Lambda Function URL) sends 2.0.
// serverless-express understands both, it picks the adapter per invocation,
// so this handler only needs to normalize what it touches itself: headers and the request path
type ApiGatewayEvent = APIGatewayProxyEvent | APIGatewayProxyEventV2
type ApiGatewayResult = APIGatewayProxyResult | APIGatewayProxyStructuredResultV2
type ProxyHandler = (event: ApiGatewayEvent, context: Context) => Promise<ApiGatewayResult>

let proxyHandler: ProxyHandler

async function bootstrap(): Promise<ProxyHandler> {
  const expressApp = express()
  const app = await NestFactory.create(
    LambdaModule,
    new ExpressAdapter(expressApp),
    { bufferLogs: true } // means: don't write logs just yet, to get a grace period to configure a logger
  )
  app.useLogger(app.get(Logger))
  app.flushLogs() // now, when logger configured -> do flush all logs to it and drop the buffer
  app.useGlobalInterceptors(new LoggerErrorInterceptor()) // see https://github.com/iamolegga/nestjs-pino?tab=readme-ov-file#expose-stack-trace-and-error-class-in-err-property
  init(app)
  await app.init()
  logger.level = 'info' // bootstrap logs are flushed (and dropped by 'warn'), from now on log normally

  // @ts-expect-error by design
  return serverlessExpress({ app: expressApp }) as ProxyHandler
}

// the same discriminator serverless-express uses to choose its event adapter
function isV2(event: ApiGatewayEvent): event is APIGatewayProxyEventV2 {
  return (event as APIGatewayProxyEventV2).version === '2.0'
}

/**
 * v1 events carry the same header twice: `headers` and `multiValueHeaders`.
 * serverless-express reads `multiValueHeaders` whenever it is present, so write both
 */
function setHeader(event: ApiGatewayEvent, name: string, value: string): void {
  if (!event.headers) {
    event.headers = {}
  }
  event.headers[name] = value
  if (!isV2(event) && event.multiValueHeaders) {
    event.multiValueHeaders[name] = [value]
  }
}

/**
 * The path is used to map request -> route, and it arrives with prefixes NestJS must not see:
 *   HTTP API (v2): rawPath = /{stage}/{app-name}/{our-endpoint}
 *   REST API (v1): path    = /{app-name}/{our-endpoint}, the stage lives in requestContext only
 * We use a multi-tenant AGW, so each microservice has prefix = app-name. Drop the stage when the
 * path happens to carry it, then drop the app-name
 */
function normalizePath(event: ApiGatewayEvent): void {
  const v2 = isV2(event)

  const stage = event.requestContext.stage
  const path = v2 ? event.rawPath : event.path
  const withoutStage = path.startsWith(`/${stage}/`) ? path.substring(stage.length + 1) : path
  const appNameEnd = withoutStage.indexOf('/', 1)
  const normalizedPath = appNameEnd === -1 ? '/' : withoutStage.substring(appNameEnd) // no '/' left = the app-name was the whole path

  if (v2) {
    event.rawPath = normalizedPath
  } else {
    event.path = normalizedPath
    // serverless-express prefers pathParameters.proxy over event.path, drop it so the path above wins
    // (with a {proxy+} resource the proxy value is the endpoint already, but not when the REST API
    // declares every route explicitly, so do not rely on it)
    delete event.pathParameters?.['proxy']
  }
}

// noinspection JSUnusedGlobalSymbols
export const handler = async (event: ApiGatewayEvent, context: Context): Promise<ApiGatewayResult> => {
  if (!proxyHandler) {
    proxyHandler = await bootstrap()
  }

  // need to enrich the logging context with requestId and agwRequestId,
  // but unfortunately, PinoLogger is not available here, so pass via headers
  setHeader(event, 'x-request-id', context.awsRequestId)
  setHeader(event, 'x-agw-request-id', event.requestContext.requestId)
  normalizePath(event)

  return proxyHandler(event, context)
}
