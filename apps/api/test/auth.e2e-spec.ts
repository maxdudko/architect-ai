import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  assertAuthResponse,
  assertAuthSession,
  assertErrorMessageContains,
  assertOwnerWorkspace,
  assertTokenPair,
  authHeader,
  buildSignUpPayload,
  createAuthSession,
  signUp,
  TEST_PASSWORD,
} from './helpers/factories';
import {
  closeE2eApp,
  createE2eApp,
  resetDatabase,
  runMigrations,
} from './helpers/e2e-app';

const databaseUrl = process.env.DATABASE_URL;
const describeE2e = databaseUrl ? describe : describe.skip;

describeE2e('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(() => {
    runMigrations();
  });

  beforeEach(async () => {
    ({ app, prisma } = await createE2eApp());
    await resetDatabase(prisma);
  });

  afterEach(async () => {
    await closeE2eApp(app);
  });

  it('signs up a user with a personal workspace and owner role', async () => {
    const payload = buildSignUpPayload({
      firstName: 'Ada',
      lastName: 'Lovelace',
    });

    const auth = await signUp(app, payload);

    assertOwnerWorkspace(auth);
    expect(auth.user.email).toBe(payload.email.toLowerCase());
    expect(auth.activeWorkspace.name).toBe("Ada's Workspace");
  });

  it('rejects duplicate sign-up email', async () => {
    const payload = buildSignUpPayload();

    await signUp(app, payload);

    const { body } = await request(app.getHttpServer())
      .post('/auth/signup')
      .send(payload)
      .expect(409);

    assertErrorMessageContains(body, 'already exists');
  });

  it('signs in with valid credentials', async () => {
    const payload = buildSignUpPayload();

    await signUp(app, payload);

    const { body } = await request(app.getHttpServer())
      .post('/auth/signin')
      .send({ email: payload.email, password: payload.password })
      .expect(201);

    assertAuthResponse(body);
    expect(body.user.email).toBe(payload.email.toLowerCase());
  });

  it('rejects sign-in with invalid password', async () => {
    const payload = buildSignUpPayload();

    await signUp(app, payload);

    await request(app.getHttpServer())
      .post('/auth/signin')
      .send({ email: payload.email, password: 'WrongPassword1' })
      .expect(401);
  });

  it('returns authenticated user context from /auth/me', async () => {
    const signUpAuth = await signUp(app);

    const { body } = await request(app.getHttpServer())
      .get('/auth/me')
      .set(authHeader(signUpAuth.accessToken))
      .expect(200);

    assertAuthSession(body);
    expect(body.user.email).toBe(signUpAuth.user.email);
    expect(body.activeWorkspace.id).toBe(signUpAuth.activeWorkspace.id);
    expect(body.workspaces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: signUpAuth.activeWorkspace.id }),
      ]),
    );
  });

  it('rejects /auth/me without a bearer token', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('rotates tokens on refresh and preserves the active workspace', async () => {
    const { auth: signUpAuth, agent } = await createAuthSession(app);

    await new Promise((resolve) => setTimeout(resolve, 1100));

    const { body: refreshBody } = await agent
      .post('/auth/refresh')
      .send({
        activeWorkspaceId: signUpAuth.activeWorkspace.id,
      })
      .expect(201);

    assertTokenPair(refreshBody);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({})
      .expect(401);

    const { body: meBody } = await request(app.getHttpServer())
      .get('/auth/me')
      .set(authHeader(refreshBody.accessToken))
      .expect(200);

    assertAuthSession(meBody);
    expect(meBody.activeWorkspace.id).toBe(signUpAuth.activeWorkspace.id);
  });

  it('logs out and revokes the refresh token', async () => {
    const { auth: signUpAuth, agent } = await createAuthSession(app);

    await agent
      .post('/auth/logout')
      .set(authHeader(signUpAuth.accessToken))
      .send({})
      .expect(201);

    await agent.post('/auth/refresh').send({}).expect(401);
  });

  it('rejects sign-in for a soft-deleted user', async () => {
    const payload = buildSignUpPayload();
    const signUpAuth = await signUp(app, payload);

    await prisma.user.update({
      where: { id: signUpAuth.user.id },
      data: { deletedAt: new Date() },
    });

    await request(app.getHttpServer())
      .post('/auth/signin')
      .send({ email: payload.email, password: TEST_PASSWORD })
      .expect(401);
  });
});
