import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { SystemLogCategory } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { authHeader } from './helpers/factories';
import {
  closeE2eApp,
  createE2eApp,
  resetDatabase,
  runMigrations,
} from './helpers/e2e-app';

const databaseUrl = process.env.DATABASE_URL;
const describeE2e = databaseUrl ? describe : describe.skip;

const ADMIN_EMAIL = 'admin@architect.ai';
const ADMIN_PASSWORD = 'AdminPassword123!';

async function seedAdmin(prisma: PrismaService): Promise<void> {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await prisma.admin.create({
    data: {
      email: ADMIN_EMAIL,
      passwordHash,
      firstName: 'Platform',
      lastName: 'Admin',
    },
  });
}

async function adminSignIn(app: INestApplication) {
  const { body } = await request(app.getHttpServer())
    .post('/admin/auth/signin')
    .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
    .expect(201);

  return body as { accessToken: string };
}

describeE2e('Admin Logs (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(() => {
    runMigrations();
  });

  beforeEach(async () => {
    ({ app, prisma } = await createE2eApp());
    await resetDatabase(prisma);
    await seedAdmin(prisma);
  });

  afterEach(async () => {
    await closeE2eApp(app);
  });

  it('records an audit log on admin sign-in and lists it for admins', async () => {
    const adminAuth = await adminSignIn(app);

    await new Promise((resolve) => setTimeout(resolve, 50));

    const auditLogs = await prisma.systemLog.findMany({
      where: {
        category: SystemLogCategory.AUDIT,
        event: 'admin.auth.signin.success',
      },
    });
    expect(auditLogs.length).toBeGreaterThanOrEqual(1);

    const { body } = await request(app.getHttpServer())
      .get('/admin/logs')
      .query({ category: 'AUDIT', search: 'admin.auth.signin.success' })
      .set(authHeader(adminAuth.accessToken))
      .expect(200);

    expect(body.total).toBeGreaterThanOrEqual(1);
    expect(body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'AUDIT',
          event: 'admin.auth.signin.success',
        }),
      ]),
    );
  });

  it('rejects /admin/logs without an admin bearer token', async () => {
    await request(app.getHttpServer()).get('/admin/logs').expect(401);
  });

  it('excludes OPTIONS request logs when excludeOptions is true', async () => {
    await prisma.systemLog.createMany({
      data: [
        {
          category: SystemLogCategory.HTTP,
          level: 'INFO',
          event: 'http.request',
          method: 'OPTIONS',
          route: '/admin/users',
          statusCode: 204,
        },
        {
          category: SystemLogCategory.HTTP,
          level: 'INFO',
          event: 'http.request',
          method: 'GET',
          route: '/admin/users',
          statusCode: 200,
        },
        {
          category: SystemLogCategory.AUDIT,
          level: 'INFO',
          event: 'admin.user.update',
          message: 'Admin updated user',
        },
      ],
    });

    const adminAuth = await adminSignIn(app);

    const filtered = await request(app.getHttpServer())
      .get('/admin/logs')
      .query({ excludeOptions: true, pageSize: 100 })
      .set(authHeader(adminAuth.accessToken))
      .expect(200);

    const filteredItems = filtered.body.items as Array<{
      method: string | null;
    }>;
    expect(filteredItems.every((item) => item.method !== 'OPTIONS')).toBe(true);
    expect(filtered.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: 'GET', route: '/admin/users' }),
        expect.objectContaining({ event: 'admin.user.update' }),
      ]),
    );

    const unfiltered = await request(app.getHttpServer())
      .get('/admin/logs')
      .query({ excludeOptions: false, pageSize: 100 })
      .set(authHeader(adminAuth.accessToken))
      .expect(200);

    expect(unfiltered.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: 'OPTIONS', route: '/admin/users' }),
      ]),
    );
  });
});
