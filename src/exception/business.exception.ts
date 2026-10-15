/**
 * Business rule violation: the request is well-formed, but can't be processed given the current state of data
 * (e.g. order status, existing invoice). AppExceptionFilter turns it into HTTP 422 Unprocessable Entity.
 *
 * Deliberately not an HttpException: services are also called outside HTTP (SQS events),
 * so they throw domain exceptions and only the filter knows how to map them to HTTP
 */
export class BusinessException extends Error {
  /**
   * @param message human-readable reason, returned in the response body
   * @param code optional machine-readable reason, returned as 'errorCode' so a client can react to a specific case
   */
  constructor(message: string, readonly code?: string) {
    super(message)
    this.name = BusinessException.name
  }
}
