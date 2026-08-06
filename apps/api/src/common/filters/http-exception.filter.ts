import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { resolveRequestLogContext } from '../logging/request-log-context';
import { captureError } from '../observability/error-tracker';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request & { requestId?: string }>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    const requestContext = resolveRequestLogContext(request);
    const message =
      exception instanceof Error
        ? exception.message
        : typeof exceptionResponse === 'string'
          ? exceptionResponse
          : 'Request failed';

    this.logger.error(
      JSON.stringify({
        event: 'http_exception',
        ...requestContext,
        statusCode: status,
        error: exceptionResponse,
        message,
      }),
      exception instanceof Error ? exception.stack : undefined,
    );
    if (status >= 500) {
      captureError(exception, requestContext);
    }

    response.status(status).json({
      statusCode: status,
      path: request.url,
      timestamp: new Date().toISOString(),
      error: exceptionResponse,
      requestId: requestContext.requestId,
    });
  }
}
