import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { SystemLogCategory } from '@prisma/client';
import { Request, Response } from 'express';
import { resolveRequestLogContext } from '../logging/request-log-context';
import { captureError } from '../observability/error-tracker';
import { SystemLogsService } from '../../system-logs/system-logs.service';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor(private readonly systemLogsService?: SystemLogsService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<
      Request & {
        requestId?: string;
        user?: { sub?: string; tokenType?: string; activeWorkspaceId?: string };
        workspace?: { id?: string };
      }
    >();

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

    const actor =
      request.user?.tokenType === 'admin'
        ? { actorType: 'admin', actorId: request.user.sub ?? null }
        : request.user?.sub
          ? { actorType: 'user', actorId: request.user.sub }
          : { actorType: null, actorId: null };

    this.systemLogsService?.record({
      category: SystemLogCategory.HTTP,
      level: this.systemLogsService.levelFromStatusCode(status),
      event: 'http_exception',
      message,
      requestId: requestContext.requestId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      workspaceId: requestContext.organizationId,
      repositoryId: requestContext.repositoryId,
      method: requestContext.method,
      route: requestContext.route,
      statusCode: status,
      metadata: {
        error:
          typeof exceptionResponse === 'string'
            ? exceptionResponse
            : exceptionResponse,
      },
    });

    response.status(status).json({
      statusCode: status,
      path: request.url,
      timestamp: new Date().toISOString(),
      error: exceptionResponse,
      requestId: requestContext.requestId,
    });
  }
}
