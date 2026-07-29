import request from 'supertest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { RetrievalService } from '../src/modules/retrieval/retrieval.service';
import type { RetrievedContext } from '../src/modules/retrieval/types/retrieved-context.type';
import { PrismaService } from '../src/prisma/prisma.service';
import { authHeader, signUp } from './helpers/factories';
import {
  closeE2eApp,
  configureTestEnvironment,
  resetDatabase,
  runMigrations,
} from './helpers/e2e-app';

const databaseUrl = process.env.DATABASE_URL;
const describeE2e = databaseUrl ? describe : describe.skip;

const emptyRetrievedContext: RetrievedContext = {
  chunks: [],
  symbols: [],
  files: [],
  references: [],
};

describeE2e('Chat (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(() => {
    runMigrations();
  });

  beforeEach(async () => {
    configureTestEnvironment();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(RetrievalService)
      .useValue({
        retrieve: jest.fn().mockResolvedValue(emptyRetrievedContext),
        getMetrics: jest.fn().mockReturnValue({}),
      })
      .compile();

    app = moduleFixture.createNestApplication();
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

    prisma = app.get(PrismaService);
    await resetDatabase(prisma);
  });

  afterEach(async () => {
    await closeE2eApp(app);
  });

  it('creates a conversation and generates an answer with sources', async () => {
    const auth = await signUp(app);
    const workspaceId = auth.activeWorkspace.id;

    const { body: conversation } = await request(app.getHttpServer())
      .post(`/workspaces/${workspaceId}/conversations`)
      .set(authHeader(auth.accessToken))
      .send({ title: 'Auth questions' })
      .expect(201);

    expect(conversation).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        workspaceId,
        title: 'Auth questions',
      }),
    );

    const { body: answer } = await request(app.getHttpServer())
      .post(
        `/workspaces/${workspaceId}/conversations/${conversation.id}/messages`,
      )
      .set(authHeader(auth.accessToken))
      .send({ content: 'How does authentication work?' })
      .expect(201);

    expect(answer.userMessage.content).toBe('How does authentication work?');
    expect(answer.assistantMessage.content.length).toBeGreaterThan(0);
    expect(answer.sources).toEqual([]);
    expect(answer.assistantMessage.metadata).toEqual(
      expect.objectContaining({
        provider: 'mock',
        sources: [],
      }),
    );

    const { body: detail } = await request(app.getHttpServer())
      .get(`/workspaces/${workspaceId}/conversations/${conversation.id}`)
      .set(authHeader(auth.accessToken))
      .expect(200);

    expect(detail.messages).toHaveLength(2);
  });

  it('renames a conversation', async () => {
    const auth = await signUp(app);
    const workspaceId = auth.activeWorkspace.id;

    const { body: conversation } = await request(app.getHttpServer())
      .post(`/workspaces/${workspaceId}/conversations`)
      .set(authHeader(auth.accessToken))
      .send({})
      .expect(201);

    expect(conversation.title).toBeNull();

    const { body: updated } = await request(app.getHttpServer())
      .patch(`/workspaces/${workspaceId}/conversations/${conversation.id}`)
      .set(authHeader(auth.accessToken))
      .send({ title: 'Auth questions' })
      .expect(200);

    expect(updated).toEqual(
      expect.objectContaining({
        id: conversation.id,
        title: 'Auth questions',
      }),
    );

    const { body: listed } = await request(app.getHttpServer())
      .get(`/workspaces/${workspaceId}/conversations`)
      .set(authHeader(auth.accessToken))
      .expect(200);

    expect(listed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: conversation.id,
          title: 'Auth questions',
        }),
      ]),
    );
  });
});
