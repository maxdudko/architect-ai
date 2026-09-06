import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { SystemLogCategory } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { Application, NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { assertRequiredProductionEnv } from './common/config/assert-production-env';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { resolveRequestLogContext } from './common/logging/request-log-context';
import { initErrorTracker } from './common/observability/error-tracker';
import { SystemLogsService } from './system-logs/system-logs.service';

const SKIP_SYSTEM_LOG_PATH_PREFIXES = ['/docs', '/health'];

function getCorsOrigins(): string | string[] {
  const configured = process.env.CORS_ORIGINS;
  if (!configured) {
    return 'http://localhost:3000';
  }

  const origins = configured
    .split(',')
    .map((origin: string) => origin.trim())
    .filter(Boolean);

  return origins.length === 1 ? origins[0] : origins;
}

function shouldSkipSystemLog(path: string | undefined): boolean {
  if (!path) {
    return false;
  }
  const normalized = path.split('?')[0] ?? path;
  return SKIP_SYSTEM_LOG_PATH_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
  );
}

async function bootstrap() {
  assertRequiredProductionEnv();
  initErrorTracker();
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const expressApp = app.getHttpAdapter().getInstance() as Application;
  expressApp.set('trust proxy', 1);
  const requestLogger = new Logger('RequestLogger');
  const systemLogsService = app.get(SystemLogsService);

  app.use((request: Request, response: Response, next: NextFunction) => {
    const startedAt = Date.now();
    const headerRequestId = request.header('x-request-id');
    const requestId = headerRequestId?.trim() || randomUUID();
    (request as Request & { requestId?: string }).requestId = requestId;
    response.setHeader('x-request-id', requestId);

    response.on('finish', () => {
      const context = resolveRequestLogContext(
        request as Request & {
          requestId?: string;
          user?: {
            sub?: string;
            tokenType?: string;
            activeWorkspaceId?: string;
          };
          workspace?: { id?: string };
          params?: Record<string, string | undefined>;
          body?: Record<string, unknown>;
        },
      );
      const latencyMs = Date.now() - startedAt;
      requestLogger.log(
        JSON.stringify({
          event: 'http_request',
          ...context,
          statusCode: response.statusCode,
          latencyMs,
          service: 'api',
        }),
      );

      if (shouldSkipSystemLog(context.route ?? request.path)) {
        return;
      }

      const user = (
        request as Request & {
          user?: { sub?: string; tokenType?: string };
        }
      ).user;
      const actor =
        user?.tokenType === 'admin'
          ? { actorType: 'admin', actorId: user.sub ?? null }
          : user?.sub
            ? { actorType: 'user', actorId: user.sub }
            : { actorType: null, actorId: null };

      systemLogsService.record({
        category: SystemLogCategory.HTTP,
        level: systemLogsService.levelFromStatusCode(response.statusCode),
        event: 'http_request',
        requestId: context.requestId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        workspaceId: context.organizationId,
        repositoryId: context.repositoryId,
        method: context.method,
        route: context.route,
        statusCode: response.statusCode,
        latencyMs,
      });
    });

    next();
  });

  app.enableCors({
    origin: getCorsOrigins(),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'x-request-id'],
    exposedHeaders: ['x-request-id'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter(systemLogsService));

  const nodeEnv = process.env.NODE_ENV?.toLowerCase() ?? 'development';
  if (nodeEnv !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Architect AI API')
      .setDescription(
        'Authentication, workspace, and repository management API',
      )
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  await app.listen(process.env.PORT ?? 5000);
}
void bootstrap();
