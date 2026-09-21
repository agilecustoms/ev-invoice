import { Injectable, type NestMiddleware } from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'

function kebabToCamel(str: string): string {
  return str.replace(/-([a-z])/g, (_, char) => char.toUpperCase())
}

// x-agw-request-id -> agwRequestId
const HEADERS = [
  'x-request-id', 'x-agw-request-id', // artificial headers come from lambda.ts
  'x-flow-id', 'x-browser-request-id', 'x-e2e-test-id' // real headers, highly custom to AgileCustoms
]
  .reduce((map, header) => {
    map[header] = kebabToCamel(header.substring(2)) // strip 'x-'
    return map
  }, {} as Record<string, string>)

/**
 * Add some HTTP headers to the logging context (like MDC in Java)
 */
@Injectable()
export class LoggerContextMiddleware implements NestMiddleware {
  constructor(private readonly logger: PinoLogger) {}

  use(req: { headers: Record<string, string> }, _: never, next: () => void) {
    for (const [header, logKey] of Object.entries(HEADERS)) {
      const value = req.headers[header]
      if (value) {
        this.logger.assign({ [logKey]: value })
      }
    }
    next()
  }
}
