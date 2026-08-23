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
  uniqueEmail,
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

  describe('identity OAuth', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    function requestUrl(input: RequestInfo | URL): string {
      if (typeof input === 'string') {
        return input;
      }
      if (input instanceof URL) {
        return input.href;
      }
      return input.url;
    }

    function mockGoogleProfile(params: {
      email: string;
      verified?: boolean;
      id?: string;
    }): void {
      global.fetch = jest.fn((input: RequestInfo | URL) => {
        const url = requestUrl(input);
        if (url === 'https://oauth2.googleapis.com/token') {
          return Promise.resolve(
            new Response(JSON.stringify({ access_token: 'google-token' }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        }
        if (url === 'https://www.googleapis.com/oauth2/v2/userinfo') {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                id: params.id ?? 'google-user-1',
                email: params.email,
                verified_email: params.verified ?? true,
                given_name: 'Ada',
                family_name: 'Lovelace',
                name: 'Ada Lovelace',
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          );
        }
        return Promise.reject(new Error(`Unexpected fetch: ${url}`));
      }) as typeof fetch;
    }

    function mockGithubProfile(params: {
      email?: string;
      verified?: boolean;
      id?: number;
    }): void {
      global.fetch = jest.fn((input: RequestInfo | URL) => {
        const url = requestUrl(input);
        if (url === 'https://github.com/login/oauth/access_token') {
          return Promise.resolve(
            new Response(JSON.stringify({ access_token: 'github-token' }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        }
        if (url === 'https://api.github.com/user') {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                id: params.id ?? 42,
                login: 'ada',
                name: 'Ada Lovelace',
                avatar_url: 'https://example.com/ada.png',
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          );
        }
        if (url === 'https://api.github.com/user/emails') {
          return Promise.resolve(
            new Response(
              JSON.stringify(
                params.email
                  ? [
                      {
                        email: params.email,
                        primary: true,
                        verified: params.verified ?? true,
                      },
                    ]
                  : [],
              ),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          );
        }
        return Promise.reject(new Error(`Unexpected fetch: ${url}`));
      }) as typeof fetch;
    }

    async function startOauth(
      provider: 'google' | 'github',
    ): Promise<{ state: string; agent: ReturnType<typeof request.agent> }> {
      const agent = request.agent(app.getHttpServer());
      const { headers } = await agent
        .get(`/auth/oauth/${provider}/start`)
        .redirects(0)
        .expect(302);
      const location = new URL(headers.location);
      const state = location.searchParams.get('state');
      if (!state) {
        throw new Error('OAuth start did not return state');
      }
      return { state, agent };
    }

    it('starts Google OAuth and completes sign-up through the refresh cookie', async () => {
      const email = uniqueEmail('google');
      mockGoogleProfile({ email });
      const { state, agent } = await startOauth('google');

      const callback = await agent
        .get('/auth/oauth/google/callback')
        .query({ code: 'google-code', state })
        .redirects(0)
        .expect(302);

      expect(callback.headers.location).toBe(
        'http://localhost:3000/auth/oauth/complete',
      );

      const { body: refreshBody } = await agent
        .post('/auth/refresh')
        .send({})
        .expect(201);

      assertTokenPair(refreshBody);

      const { body: meBody } = await request(app.getHttpServer())
        .get('/auth/me')
        .set(authHeader(refreshBody.accessToken))
        .expect(200);

      assertAuthSession(meBody);
      expect(meBody.user.email).toBe(email);
      expect(meBody.user.emailVerified).toBe(true);
      expect(meBody.activeWorkspace.name).toBe("Ada's Workspace");

      const created = await prisma.user.findUnique({
        where: { email },
        include: { identityAccounts: true },
      });
      expect(created?.passwordHash).toBeNull();
      expect(created?.identityAccounts).toEqual([
        expect.objectContaining({ provider: 'GOOGLE', email }),
      ]);
    });

    it('auto-links Google to an existing email/password user', async () => {
      const payload = buildSignUpPayload({
        firstName: 'Ada',
        lastName: 'Lovelace',
      });
      const existing = await signUp(app, payload);
      mockGoogleProfile({ email: payload.email.toLowerCase() });
      const { state, agent } = await startOauth('google');

      await agent
        .get('/auth/oauth/google/callback')
        .query({ code: 'google-code', state })
        .redirects(0)
        .expect(302);

      const { body: refreshBody } = await agent
        .post('/auth/refresh')
        .send({})
        .expect(201);

      const { body: meBody } = await request(app.getHttpServer())
        .get('/auth/me')
        .set(authHeader(refreshBody.accessToken))
        .expect(200);

      expect(meBody.user.id).toBe(existing.user.id);

      const linked = await prisma.identityAccount.findMany({
        where: { userId: existing.user.id },
      });
      expect(linked).toHaveLength(1);
      expect(linked[0]?.provider).toBe('GOOGLE');
    });

    it('rejects password sign-in for an OAuth-only user', async () => {
      const email = uniqueEmail('oauth-only');
      mockGoogleProfile({ email });
      const { state, agent } = await startOauth('google');

      await agent
        .get('/auth/oauth/google/callback')
        .query({ code: 'google-code', state })
        .redirects(0)
        .expect(302);

      const { body } = await request(app.getHttpServer())
        .post('/auth/signin')
        .send({ email, password: TEST_PASSWORD })
        .expect(401);

      assertErrorMessageContains(body, 'Google or GitHub');
    });

    it('rejects GitHub login when no verified email is available', async () => {
      mockGithubProfile({ email: 'hidden@github.example', verified: false });
      const { state, agent } = await startOauth('github');

      const callback = await agent
        .get('/auth/oauth/github/callback')
        .query({ code: 'github-code', state })
        .redirects(0)
        .expect(302);

      expect(callback.headers.location).toBe(
        'http://localhost:3000/sign-in?oauth_error=email_unavailable',
      );
    });

    it('starts GitHub identity OAuth with the identity callback URI', async () => {
      const { headers } = await request(app.getHttpServer())
        .get('/auth/oauth/github/start')
        .redirects(0)
        .expect(302);

      const location = new URL(headers.location);
      expect(location.origin).toBe('https://github.com');
      expect(location.searchParams.get('scope')).toBe('read:user user:email');
      expect(location.searchParams.get('redirect_uri')).toBe(
        'http://localhost:5000/auth/oauth/github/callback',
      );
    });
  });
});
