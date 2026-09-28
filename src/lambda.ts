import serverlessExpress from '@codegenie/serverless-express'
import { NestFactory } from '@nestjs/core'
import { ExpressAdapter } from '@nestjs/platform-express'
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyEventV2,
  APIGatewayProxyResult,
  APIGatewayProxyStructuredResultV2,
  Context,
  SQSEvent
} from 'aws-lambda'
import express from 'express'
import { Logger, LoggerErrorInterceptor } from 'nestjs-pino'
import { APP_NAME, init } from './app.module.js'
import { SqsController } from './controller/sqs.controller.js'
import { LambdaModule, logger } from './lambda.module.js'

// REST API sends payload format 1.0, HTTP API (and Lambda Function URL) sends 2.0.
// serverless-express understands both, it picks the adapter per invocation,
// so this handler only needs to normalize what it touches itself: the request path
type ApiGatewayEvent = APIGatewayProxyEvent | APIGatewayProxyEventV2
type ApiGatewayResult = APIGatewayProxyResult | APIGatewayProxyStructuredResultV2
type ProxyHandler = (event: ApiGatewayEvent, context: Context) => Promise<ApiGatewayResult>

// one Nest app serves both API Gateway (through express) and SQS events, created on first invocation
let proxyHandler: ProxyHandler
let sqsController: SqsController

async function bootstrap(): Promise<void> {
  const expressApp = express()
  const app = await NestFactory.create(
    LambdaModule,
    new ExpressAdapter(expressApp),
    {
      bufferLogs: true, // don't write logs just yet, to get a chance to configure a logger first
      abortOnError: false // on bootstrap failure Nest rethrows instead of process.exit(1), this allows to log the error
    }
  )
  logger.level = 'warn' // skip some Nest bootstrap logs
  app.useLogger(app.get(Logger))
  app.flushLogs() // now, when logger configured -> do flush all logs to it and drop the Nest log buffer
  app.useGlobalInterceptors(new LoggerErrorInterceptor()) // see https://github.com/iamolegga/nestjs-pino?tab=readme-ov-file#expose-stack-trace-and-error-class-in-err-property
  init(app)
  await app.init()
  logger.level = 'info' // from now on log normally

  // @ts-expect-error by design
  proxyHandler = serverlessExpress({ app: expressApp }) as ProxyHandler
  sqsController = app.get(SqsController)
}

// the same discriminator serverless-express uses to choose its event adapter
function isV2(event: ApiGatewayEvent): event is APIGatewayProxyEventV2 {
  return (event as APIGatewayProxyEventV2).version === '2.0'
}

/**
 * The path is used to map request -> route, and it arrives with prefixes NestJS must not see:
 *   HTTP API (v2): rawPath = /{stage}/{app-name}/{our-endpoint}
 *   REST API (v1): path    = /{app-name}/{our-endpoint}, the stage lives in requestContext only
 * We use a multi-tenant AGW, so each microservice has prefix = app-name. Drop the stage when the
 * path happens to carry it, then drop the app-name, which is always present as the next segment
 */
function normalizePath(event: ApiGatewayEvent): void {
  const v2 = isV2(event)

  const stage = event.requestContext.stage
  const path = v2 ? event.rawPath : event.path
  const withoutStage = path.startsWith(`/${stage}/`) ? path.substring(stage.length + 1) : path
  const normalizedPath = withoutStage.substring(`/${APP_NAME}`.length)

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

function isSqs(event: ApiGatewayEvent | SQSEvent): event is SQSEvent {
  return (event as SQSEvent).Records?.[0]?.eventSource === 'aws:sqs'
}

// noinspection JSUnusedGlobalSymbols
export const handler = async (event: ApiGatewayEvent | SQSEvent, context: Context): Promise<ApiGatewayResult | void> => {
  if (!proxyHandler) {
    await bootstrap()
  }

  if (isSqs(event)) {
    return sqsController.handle(event, context)
  }

  normalizePath(event)

  return proxyHandler(event, context)
}
