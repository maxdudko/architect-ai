import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { PrismaService } from '../../src/prisma/prisma.service';
import { SystemLogsService } from '../../src/system-logs/system-logs.service';
import { upsertDefaultPlanLimits } from '../../src/usage/plan-limit.defaults';

export interface E2eContext {
  app: INestApplication;
  prisma: PrismaService;
}

const ALLOW_NON_TEST_DB = 'E2E_ALLOW_NON_TEST_DB';

/**
 * Resolves the database URL the e2e suite should run against.
 *
 * A dedicated `TEST_DATABASE_URL` always wins over `DATABASE_URL` so that a
 * developer's normal `.env` (pointing at their working database) cannot be
 * used by accident. The resolved value is written back to `DATABASE_URL` so
 * Prisma and Nest pick it up.
 */
export function resolveTestDatabaseUrl(): string | undefined {
  const testUrl = process.env.TEST_DATABASE_URL?.trim();
  if (testUrl) {
    process.env.DATABASE_URL = testUrl;
  }
  return process.env.DATABASE_URL;
}

function getDatabaseName(url: string): string | null {
  try {
    const name = new URL(url).pathname.replace(/^\//, '');
    return name || null;
  } catch {
    return null;
  }
}

/**
 * Guards every destructive e2e operation (migrations + truncation) so it can
 * only ever run against a dedicated test database.
 *
 * The e2e setup runs `TRUNCATE ... RESTART IDENTITY CASCADE` across every
 * table, so pointing it at a real database would wipe it. We refuse to proceed
 * unless the database name clearly identifies a test database (contains
 * "test") or the operator explicitly opts out via `E2E_ALLOW_NON_TEST_DB`.
 */
export function assertTestDatabase(): void {
  const url = resolveTestDatabaseUrl();

  if (!url) {
    throw new Error(
      'No database configured for e2e tests. Set TEST_DATABASE_URL (preferred) ' +
        'or DATABASE_URL to a dedicated test database.',
    );
  }

  if (process.env[ALLOW_NON_TEST_DB] === 'true') {
    return;
  }

  const databaseName = getDatabaseName(url);
  if (!databaseName || !/test/i.test(databaseName)) {
    throw new Error(
      `Refusing to run e2e setup against database "${databaseName ?? url}". ` +
        'These tests TRUNCATE every table, so they must target a dedicated ' +
        'test database. Point TEST_DATABASE_URL/DATABASE_URL at a database ' +
        `whose name contains "test", or set ${ALLOW_NON_TEST_DB}=true to override.`,
    );
  }
}

export function configureTestEnvironment(): void {
  process.env.JWT_ACCESS_SECRET =
    process.env.JWT_ACCESS_SECRET || 'test-access-secret';
  process.env.JWT_REFRESH_SECRET =
    process.env.JWT_REFRESH_SECRET || 'test-refresh-secret';
  process.env.JWT_ACCESS_TTL = process.env.JWT_ACCESS_TTL || '15m';
  process.env.JWT_REFRESH_TTL = process.env.JWT_REFRESH_TTL || '30d';
  process.env.JWT_ADMIN_ACCESS_SECRET =
    process.env.JWT_ADMIN_ACCESS_SECRET || 'test-admin-access-secret';
  process.env.JWT_ADMIN_REFRESH_SECRET =
    process.env.JWT_ADMIN_REFRESH_SECRET || 'test-admin-refresh-secret';
  process.env.JWT_ADMIN_ACCESS_TTL = process.env.JWT_ADMIN_ACCESS_TTL || '15m';
  process.env.JWT_ADMIN_REFRESH_TTL =
    process.env.JWT_ADMIN_REFRESH_TTL || '30d';
  process.env.RETRIEVAL_CACHE_DRIVER = 'memory';
  process.env.LLM_PROVIDER = 'mock';
  process.env.EMBEDDING_PROVIDER = 'mock';
  process.env.RATE_LIMIT_ENABLED = 'false';
  process.env.REPOSITORY_ACCESS_VALIDATION_ENABLED = 'false';
  process.env.WEB_URL = process.env.WEB_URL || 'http://localhost:3000';
  process.env.GOOGLE_CLIENT_ID =
    process.env.GOOGLE_CLIENT_ID || 'test-google-client-id';
  process.env.GOOGLE_CLIENT_SECRET =
    process.env.GOOGLE_CLIENT_SECRET || 'test-google-client-secret';
  process.env.GOOGLE_OAUTH_REDIRECT_URI =
    process.env.GOOGLE_OAUTH_REDIRECT_URI ||
    'http://localhost:5000/auth/oauth/google/callback';
  process.env.AUTH_GITHUB_CLIENT_ID =
    process.env.AUTH_GITHUB_CLIENT_ID || 'test-github-auth-client-id';
  process.env.AUTH_GITHUB_CLIENT_SECRET =
    process.env.AUTH_GITHUB_CLIENT_SECRET || 'test-github-auth-client-secret';
  process.env.AUTH_GITHUB_OAUTH_REDIRECT_URI =
    process.env.AUTH_GITHUB_OAUTH_REDIRECT_URI ||
    'http://localhost:5000/auth/oauth/github/callback';
  process.env.AUTH_OAUTH_STATE_SECRET =
    process.env.AUTH_OAUTH_STATE_SECRET || 'test-oauth-state-secret';
  process.env.INDEXING_TMP_DIR = join(tmpdir(), 'architect-ai-test-indexing');
  delete process.env.REDIS_URL;
  process.env.RESEND_API_KEY = '';
}

export function runMigrations(): void {
  assertTestDatabase();
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

  const app = moduleFixture.createNestApplication({ rawBody: true });
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
  app.useGlobalFilters(new HttpExceptionFilter(app.get(SystemLogsService)));
  await app.init();

  const prisma = app.get(PrismaService);
  return { app, prisma };
}

export async function resetDatabase(prisma: PrismaService): Promise<void> {
  assertTestDatabase();
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      messages,
      conversations,
      repositories,
      oauth_accounts,
      identity_accounts,
      invitations,
      password_reset_tokens,
      memberships,
      workspace_ai_settings,
      workspaces,
      users,
      admins,
      system_logs,
      plan_limits,
      stripe_webhook_events
    RESTART IDENTITY CASCADE;
  `);
  await upsertDefaultPlanLimits(prisma);
}

export async function closeE2eApp(
  app: INestApplication | undefined,
): Promise<void> {
  await app?.close();
}
