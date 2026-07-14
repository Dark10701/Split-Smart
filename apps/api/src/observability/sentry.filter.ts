import { ArgumentsHost, Catch, HttpException, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { captureError } from './sentry';

/**
 * Global exception filter that reports unexpected (5xx / non-HTTP) errors to
 * Sentry before delegating to Nest's default handling (M6-09). Client errors
 * (4xx HttpExceptions) are expected control flow and are not reported.
 */
@Catch()
export class SentryExceptionFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    if (status >= 500) captureError(exception);
    super.catch(exception, host);
  }
}
