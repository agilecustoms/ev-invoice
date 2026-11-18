import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { Module } from '@nestjs/common'
import type { Context } from 'aws-lambda'
import { APP_NAME, AppModule } from './app.module.js'
import { LambdaLoggerModule } from './lambda.module.js'
import { createHandler } from './lambda_handler.js'
import { LocalCredentialsModule } from './local.module.js'

/**
 * Invoke: runs the Lambda handler once with an event from a file (SQS message, API Gateway request), prints JSON logs
 * as in CloudWatch and the response, exits with 1 on error or HTTP 5xx. Debug a feature or replay an event w/o deploying.
 * Runtime 'localaws' (no 'local' runtime, see README): AWS resources of env prod, credentials from config/.env.localaws
 */
@Module({
  imports: [LambdaLoggerModule, LocalCredentialsModule, AppModule]
})
class InvokeModule {}

const eventFile = process.argv[2]
if (!eventFile) {
  process.stderr.write('usage: node dist/invoke events/<name>.json\n')
  process.exit(2)
}

const event = JSON.parse(readFileSync(eventFile, 'utf8'))
// only what the handler and serverless-express read
const context = {
  awsRequestId: randomUUID(),
  functionName: `local-${APP_NAME}`,
  getRemainingTimeInMillis: () => 60_000
} as Context

let exitCode = 0
try {
  const response = await createHandler(InvokeModule)(event, context)
  // not console.log: lambda.module.ts routes console.* to pino (captureLibraryLogs), response is not a log record
  process.stdout.write(`response: ${JSON.stringify(response ?? null, null, 2)}\n`)
  if (response && (response.statusCode ?? 200) >= 500) {
    exitCode = 1
  }
} catch (error) {
  console.error('invocation failed', error) // as Lambda runtime logs a thrown error, even if SqsController logged it already
  exitCode = 1
}
// SDK and HTTP clients keep sockets open, the process would not end by itself
process.exit(exitCode)
