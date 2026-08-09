import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  assertErrorMessageContains,
  authHeader,
  buildSignUpPayload,
  signUp,
} from './helpers/factories';
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

async function adminSignIn(
  app: INestApplication,
  payload: { email: string; password: string } = {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  },
) {
  const { body } = await request(app.getHttpServer())
    .post('/admin/auth/signin')
    .send(payload)
    .expect(201);

  return body as {
    accessToken: string;
    admin: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      lastLoginAt: string | null;
    };
  };
}

describeE2e('Admin (e2e)', () => {
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

  it('signs in with valid admin credentials', async () => {
    const auth = await adminSignIn(app);

    expect(auth.accessToken).toEqual(expect.any(String));
    expect(auth.admin.email).toBe(ADMIN_EMAIL);
    expect(auth).not.toHaveProperty('refreshToken');
  });

  it('rejects admin sign-in with invalid password', async () => {
    const { body } = await request(app.getHttpServer())
      .post('/admin/auth/signin')
      .send({ email: ADMIN_EMAIL, password: 'WrongPassword1' })
      .expect(401);

    assertErrorMessageContains(body, 'Invalid email or password');
  });

  it('rejects /admin/users without an admin bearer token', async () => {
    await request(app.getHttpServer()).get('/admin/users').expect(401);
  });

  it('rejects /admin/users with a user access token', async () => {
    const userAuth = await signUp(app, buildSignUpPayload());

    await request(app.getHttpServer())
      .get('/admin/users')
      .set(authHeader(userAuth.accessToken))
      .expect(401);
  });

  it('lists users for an authenticated admin', async () => {
    await signUp(
      app,
      buildSignUpPayload({
        email: 'listed-user@example.com',
        firstName: 'Listed',
        lastName: 'User',
      }),
    );
    const adminAuth = await adminSignIn(app);

    const { body } = await request(app.getHttpServer())
      .get('/admin/users')
      .set(authHeader(adminAuth.accessToken))
      .expect(200);

    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(20);
    expect(body.total).toBeGreaterThanOrEqual(1);
    expect(body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          email: 'listed-user@example.com',
          firstName: 'Listed',
          lastName: 'User',
        }),
      ]),
    );
    for (const item of body.items) {
      expect(item).not.toHaveProperty('passwordHash');
    }
  });

  it('filters users by search query', async () => {
    await signUp(
      app,
      buildSignUpPayload({
        email: 'alpha@example.com',
        firstName: 'Alpha',
        lastName: 'One',
      }),
    );
    await signUp(
      app,
      buildSignUpPayload({
        email: 'beta@example.com',
        firstName: 'Beta',
        lastName: 'Two',
      }),
    );
    const adminAuth = await adminSignIn(app);

    const { body } = await request(app.getHttpServer())
      .get('/admin/users')
      .query({ search: 'alpha' })
      .set(authHeader(adminAuth.accessToken))
      .expect(200);

    expect(body.total).toBe(1);
    expect(body.items[0].email).toBe('alpha@example.com');
  });
});
