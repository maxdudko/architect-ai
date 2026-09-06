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

  it('updates a user for an authenticated admin', async () => {
    const userAuth = await signUp(
      app,
      buildSignUpPayload({
        email: 'editable@example.com',
        firstName: 'Before',
        lastName: 'Name',
      }),
    );
    const adminAuth = await adminSignIn(app);

    const { body } = await request(app.getHttpServer())
      .patch(`/admin/users/${userAuth.user.id}`)
      .set(authHeader(adminAuth.accessToken))
      .send({
        firstName: 'After',
        lastName: 'Updated',
        email: 'updated@example.com',
        emailVerified: true,
      })
      .expect(200);

    expect(body).toEqual(
      expect.objectContaining({
        id: userAuth.user.id,
        firstName: 'After',
        lastName: 'Updated',
        email: 'updated@example.com',
        emailVerified: true,
        deletedAt: null,
      }),
    );
    expect(body).not.toHaveProperty('passwordHash');
  });

  it('rejects updating a user to an email that already exists', async () => {
    await signUp(app, buildSignUpPayload({ email: 'taken@example.com' }));
    const userAuth = await signUp(
      app,
      buildSignUpPayload({ email: 'other@example.com' }),
    );
    const adminAuth = await adminSignIn(app);

    const { body } = await request(app.getHttpServer())
      .patch(`/admin/users/${userAuth.user.id}`)
      .set(authHeader(adminAuth.accessToken))
      .send({ email: 'taken@example.com' })
      .expect(409);

    assertErrorMessageContains(body, 'A user with this email already exists');
  });

  it('bans a user and blocks further sign-in', async () => {
    const payload = buildSignUpPayload({
      email: 'ban-me@example.com',
      password: 'Password123!',
    });
    const userAuth = await signUp(app, payload);
    const adminAuth = await adminSignIn(app);

    const { body } = await request(app.getHttpServer())
      .post(`/admin/users/${userAuth.user.id}/ban`)
      .set(authHeader(adminAuth.accessToken))
      .expect(201);

    expect(body.deletedAt).toEqual(expect.any(String));

    await request(app.getHttpServer())
      .post('/auth/signin')
      .send({ email: payload.email, password: payload.password })
      .expect(401);

    const listed = await request(app.getHttpServer())
      .get('/admin/users')
      .query({ includeDeleted: true, search: payload.email })
      .set(authHeader(adminAuth.accessToken))
      .expect(200);

    expect(listed.body.items[0].deletedAt).toEqual(expect.any(String));
  });

  it('unbans a banned user', async () => {
    const payload = buildSignUpPayload({
      email: 'unban-me@example.com',
      password: 'Password123!',
    });
    const userAuth = await signUp(app, payload);
    const adminAuth = await adminSignIn(app);

    await request(app.getHttpServer())
      .post(`/admin/users/${userAuth.user.id}/ban`)
      .set(authHeader(adminAuth.accessToken))
      .expect(201);

    const { body } = await request(app.getHttpServer())
      .post(`/admin/users/${userAuth.user.id}/unban`)
      .set(authHeader(adminAuth.accessToken))
      .expect(201);

    expect(body.deletedAt).toBeNull();

    await request(app.getHttpServer())
      .post('/auth/signin')
      .send({ email: payload.email, password: payload.password })
      .expect(201);
  });
});
