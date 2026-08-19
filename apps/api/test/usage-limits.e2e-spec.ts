import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { UsageMetric } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  authHeader,
  buildRepositoryPayload,
  connectRepository,
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

async function adminSignIn(app: INestApplication) {
  const { body } = await request(app.getHttpServer())
    .post('/admin/auth/signin')
    .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
    .expect(201);
  return body as { accessToken: string };
}

describeE2e('Usage limits and workspace AI (e2e)', () => {
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

  it('rejects connecting a second repository on the default Free plan', async () => {
    const auth = await signUp(app);
    const workspaceId = auth.activeWorkspace.id;

    await connectRepository(app, auth.accessToken, workspaceId);

    const { body } = await request(app.getHttpServer())
      .post(`/workspaces/${workspaceId}/repositories`)
      .set(authHeader(auth.accessToken))
      .send(buildRepositoryPayload())
      .expect(403);

    expect(body.error).toEqual(
      expect.objectContaining({
        code: 'USAGE_LIMIT_EXCEEDED',
        metric: UsageMetric.REPOSITORIES,
        limit: 1,
      }),
    );
  });

  it('blocks AI questions after an admin sets the Free plan limit to 0', async () => {
    const auth = await signUp(app);
    const workspaceId = auth.activeWorkspace.id;
    const admin = await adminSignIn(app);

    await request(app.getHttpServer())
      .patch('/admin/plans/FREE/limits')
      .set(authHeader(admin.accessToken))
      .send({
        limits: [{ metric: UsageMetric.AI_QUESTIONS, maxValue: 0 }],
      })
      .expect(200);

    const { body: conversation } = await request(app.getHttpServer())
      .post(`/workspaces/${workspaceId}/conversations`)
      .set(authHeader(auth.accessToken))
      .send({ title: 'Limit check' })
      .expect(201);

    const { body } = await request(app.getHttpServer())
      .post(
        `/workspaces/${workspaceId}/conversations/${conversation.id}/messages`,
      )
      .set(authHeader(auth.accessToken))
      .send({ content: 'How does authentication work?' })
      .expect(403);

    expect(body.error).toEqual(
      expect.objectContaining({
        code: 'USAGE_LIMIT_EXCEEDED',
        metric: UsageMetric.AI_QUESTIONS,
        limit: 0,
      }),
    );

    const messages = await prisma.message.count({
      where: { conversationId: conversation.id },
    });
    expect(messages).toBe(0);
  });

  it('stores a BYOK key without returning it', async () => {
    const auth = await signUp(app);
    const workspaceId = auth.activeWorkspace.id;
    const apiKey = 'sk-test-secret-key-1234';

    const { body: saved } = await request(app.getHttpServer())
      .put(`/workspaces/${workspaceId}/ai-settings/credentials`)
      .set(authHeader(auth.accessToken))
      .send({ provider: 'OPENAI', apiKey })
      .expect(200);

    expect(saved).toEqual(
      expect.objectContaining({
        mode: 'BYOK',
        activeProvider: 'OPENAI',
        credentials: [
          expect.objectContaining({ provider: 'OPENAI', keyLast4: '1234' }),
        ],
      }),
    );
    expect(JSON.stringify(saved)).not.toContain(apiKey);

    const { body: fetched } = await request(app.getHttpServer())
      .get(`/workspaces/${workspaceId}/ai-settings`)
      .set(authHeader(auth.accessToken))
      .expect(200);

    expect(fetched.mode).toBe('BYOK');
    expect(fetched.credentials).toEqual([
      expect.objectContaining({ provider: 'OPENAI', keyLast4: '1234' }),
    ]);
    expect(JSON.stringify(fetched)).not.toContain(apiKey);

    const stored = await prisma.workspaceAiCredential.findUnique({
      where: { workspaceId_provider: { workspaceId, provider: 'OPENAI' } },
    });
    expect(stored?.apiKeyEncrypted).toBeTruthy();
    expect(stored?.apiKeyEncrypted).not.toBe(apiKey);
  });

  it('tests a pasted OpenAI key without saving it', async () => {
    const auth = await signUp(app);
    const workspaceId = auth.activeWorkspace.id;
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
    } as Response);

    try {
      const { body } = await request(app.getHttpServer())
        .post(`/workspaces/${workspaceId}/ai-settings/test`)
        .set(authHeader(auth.accessToken))
        .send({ provider: 'OPENAI', apiKey: 'sk-pasted-test-key-1234' })
        .expect(200);

      expect(body).toEqual({
        ok: true,
        message: 'OpenAI accepted this API key.',
      });
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\/models$/),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            authorization: 'Bearer sk-pasted-test-key-1234',
          }),
        }),
      );

      const stored = await prisma.workspaceAiCredential.findMany({
        where: { workspaceId },
      });
      expect(stored).toEqual([]);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('rejects testing when no key is pasted or saved', async () => {
    const auth = await signUp(app);
    const workspaceId = auth.activeWorkspace.id;

    const { body } = await request(app.getHttpServer())
      .post(`/workspaces/${workspaceId}/ai-settings/test`)
      .set(authHeader(auth.accessToken))
      .send({ provider: 'OPENAI' })
      .expect(400);

    expect(body.error).toEqual(
      expect.objectContaining({
        message: 'Paste an API key for OpenAI to test, or save one first.',
      }),
    );
  });

  it('uncaps AI questions and onboarding guides while BYOK is active', async () => {
    const auth = await signUp(app);
    const workspaceId = auth.activeWorkspace.id;

    await request(app.getHttpServer())
      .put(`/workspaces/${workspaceId}/ai-settings/credentials`)
      .set(authHeader(auth.accessToken))
      .send({ provider: 'OPENAI', apiKey: 'sk-test-secret-key-1234' })
      .expect(200);

    const { body } = await request(app.getHttpServer())
      .get(`/workspaces/${workspaceId}/usage`)
      .set(authHeader(auth.accessToken))
      .expect(200);

    expect(body.aiMode).toBe('BYOK');
    expect(body.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metric: UsageMetric.AI_QUESTIONS,
          limit: null,
          remaining: null,
        }),
        expect.objectContaining({
          metric: UsageMetric.GUIDE_GENERATIONS,
          limit: null,
          remaining: null,
        }),
        expect.objectContaining({
          metric: UsageMetric.REPOSITORIES,
          limit: 1,
        }),
        expect.objectContaining({
          metric: UsageMetric.INDEXING_RUNS,
          limit: 5,
        }),
        expect.objectContaining({
          metric: UsageMetric.MEMBERS,
          limit: 3,
        }),
      ]),
    );
  });
});
