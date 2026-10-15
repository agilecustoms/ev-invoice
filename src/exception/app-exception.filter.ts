import { type ArgumentsHost, Catch, Logger, UnprocessableEntityException } from '@nestjs/common'
import { BaseExceptionFilter } from '@nestjs/core'
import { BusinessException } from './business.exception.js'

/**
 * Single place that maps project-specific exceptions to HTTP responses, registered globally in AppModule (APP_FILTER).
 * Catches everything, handles own exception types and delegates the rest to Nest default handling (BaseExceptionFilter):
 * - HttpException (BadRequestException etc.) -> its status and body
 * - anything else -> 500 'Internal server error', logged with stack trace
 * To support a new exception type, add a branch that converts it to an HttpException
 */
@Catch()
export class AppExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name)

  override catch(exception: unknown, host: ArgumentsHost): void {
    if (exception instanceof BusinessException) {
      // expected outcome, not a bug: warn (not error) so it does not trigger error alarms, but it's visible why 422
      this.logger.warn(`business rule violation: ${exception.message}`)
      // convert to Nest's own exception, so the body has the standard shape: { statusCode, message, error, errorCode? }
      const httpException = new UnprocessableEntityException(exception.message, { cause: exception, errorCode: exception.code })
      super.catch(httpException, host)
      return
    }
    super.catch(exception, host)
  }
}
