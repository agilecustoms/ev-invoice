import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common'
import type { Request } from 'express'
import { PinoLogger } from 'nestjs-pino'
import type { Observable } from 'rxjs'

/**
 * Puts 'route' (endpoint pattern, ex: 'GET /create') in every log record of the HTTP request, registered globally in AppModule.
 * SQS events don't go through Nest interceptors, SqsController sets 'route' itself
 */
@Injectable()
export class RouteLogInterceptor implements NestInterceptor {
  constructor(private readonly logger: PinoLogger) {
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>()
    this.logger.assign({ route: `${request.method} ${request.route.path}` })
    return next.handle()
  }
}
