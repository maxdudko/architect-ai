import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { PrismaService } from '../../src/prisma/prisma.service';

export interface E2eContext {
  app: INestApplication;
  prisma: PrismaService;
}

export function configureTestEnvironment(): void {
  process.env.JWT_ACCESS_SECRET ??= 'test-access-secret';
  process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret';
  process.env.JWT_ACCESS_TTL ??= '15m';
  process.env.JWT_REFRESH_TTL ??= '30d';
  delete process.env.REDIS_URL;
}

export function runMigrations(): void {
  const apiRoot = resolve(__dirname, '../..');
  execSync('pnpm prisma migrate deploy', {
    cwd: apiRoot,
    env: process.env,
    stdio: 'pipe',
  });
}

export async function createE2eApp(): Promise<E2eContext> {
  configureTestEnvironment();

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
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
  await app.init();

  const prisma = app.get(PrismaService);
  return { app, prisma };
}

export async function resetDatabase(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      messages,
      conversations,
      repositories,
      oauth_accounts,
      invitations,
      memberships,
      workspaces,
      users
    RESTART IDENTITY CASCADE;
  `);
}

export async function closeE2eApp(app: INestApplication): Promise<void> {
  await app.close();
}
