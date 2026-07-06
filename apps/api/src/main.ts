import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

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

function assertRequiredProductionEnv(): void {
  const nodeEnv = process.env.NODE_ENV?.toLowerCase() ?? 'development';
  if (nodeEnv === 'development' || nodeEnv === 'test') {
    return;
  }

  const requiredVars = ['TOKEN_ENCRYPTION_KEY', 'GITHUB_OAUTH_STATE_SECRET'];
  const missingVars = requiredVars.filter((name) => {
    const value = process.env[name];
    return !value || value.trim().length === 0;
  });

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}`,
    );
  }
}

async function bootstrap() {
  assertRequiredProductionEnv();
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: getCorsOrigins(),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
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
  app.useGlobalFilters(new HttpExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('Architect AI API')
    .setDescription('Authentication, workspace, and repository management API')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT ?? 5000);
}
void bootstrap();
