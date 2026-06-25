import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import {
  assertRepository,
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

describeE2e('Repository isolation (e2e)', () => {
  let app: INestApplication;

  beforeAll(() => {
    runMigrations();
  });

  beforeEach(async () => {
    const context = await createE2eApp();
    app = context.app;
    await resetDatabase(context.prisma);
  });

  afterEach(async () => {
    await closeE2eApp(app);
  });

  it('lists repositories only within the requested workspace', async () => {
    const auth = await signUp(app);

    const { body: teamWorkspace } = await request(app.getHttpServer())
      .post('/workspaces')
      .set(authHeader(auth.accessToken))
      .send({ name: 'Team Workspace' })
      .expect(201);

    const repository = await connectRepository(
      app,
      auth.accessToken,
      auth.activeWorkspace.id,
    );

    const { body: personalRepos } = await request(app.getHttpServer())
      .get(`/workspaces/${auth.activeWorkspace.id}/repositories`)
      .set(authHeader(auth.accessToken))
      .expect(200);

    const { body: teamRepos } = await request(app.getHttpServer())
      .get(`/workspaces/${teamWorkspace.id}/repositories`)
      .set(authHeader(auth.accessToken))
      .expect(200);

    expect(personalRepos).toHaveLength(1);
    expect(personalRepos[0].id).toBe(repository.id);
    expect(teamRepos).toHaveLength(0);
  });

  it('returns not found when fetching a repository from another workspace', async () => {
    const auth = await signUp(app);

    const { body: teamWorkspace } = await request(app.getHttpServer())
      .post('/workspaces')
      .set(authHeader(auth.accessToken))
      .send({ name: 'Other Workspace' })
      .expect(201);

    const repository = await connectRepository(
      app,
      auth.accessToken,
      auth.activeWorkspace.id,
    );

    await request(app.getHttpServer())
      .get(`/workspaces/${teamWorkspace.id}/repositories/${repository.id}`)
      .set(authHeader(auth.accessToken))
      .expect(404);
  });

  it('denies repository access to users outside the workspace', async () => {
    const owner = await signUp(app);
    await connectRepository(app, owner.accessToken, owner.activeWorkspace.id);

    const outsider = await signUp(app);

    await request(app.getHttpServer())
      .get(`/workspaces/${owner.activeWorkspace.id}/repositories`)
      .set(authHeader(outsider.accessToken))
      .expect(403);
  });

  it('prevents connecting the same external repository to multiple workspaces', async () => {
    const auth = await signUp(app);

    const { body: secondWorkspace } = await request(app.getHttpServer())
      .post('/workspaces')
      .set(authHeader(auth.accessToken))
      .send({ name: 'Second Workspace' })
      .expect(201);

    const payload = buildRepositoryPayload();
    await connectRepository(
      app,
      auth.accessToken,
      auth.activeWorkspace.id,
      payload,
    );

    const { body: errorBody } = await request(app.getHttpServer())
      .post(`/workspaces/${secondWorkspace.id}/repositories`)
      .set(authHeader(auth.accessToken))
      .send(payload)
      .expect(409);

    expect(errorBody.error).toEqual(
      expect.objectContaining({
        message: expect.stringContaining('another workspace'),
      }),
    );
  });

  it('scopes repository updates and deletes to the owning workspace', async () => {
    const auth = await signUp(app);

    const { body: otherWorkspace } = await request(app.getHttpServer())
      .post('/workspaces')
      .set(authHeader(auth.accessToken))
      .send({ name: 'Isolated Workspace' })
      .expect(201);

    const repository = await connectRepository(
      app,
      auth.accessToken,
      auth.activeWorkspace.id,
    );

    await request(app.getHttpServer())
      .patch(`/workspaces/${otherWorkspace.id}/repositories/${repository.id}`)
      .set(authHeader(auth.accessToken))
      .send({ defaultBranch: 'develop' })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/workspaces/${otherWorkspace.id}/repositories/${repository.id}`)
      .set(authHeader(auth.accessToken))
      .expect(404);

    const { body: updated } = await request(app.getHttpServer())
      .patch(
        `/workspaces/${auth.activeWorkspace.id}/repositories/${repository.id}`,
      )
      .set(authHeader(auth.accessToken))
      .send({ defaultBranch: 'develop' })
      .expect(200);

    assertRepository(updated);
    expect(updated.defaultBranch).toBe('develop');

    await request(app.getHttpServer())
      .delete(
        `/workspaces/${auth.activeWorkspace.id}/repositories/${repository.id}`,
      )
      .set(authHeader(auth.accessToken))
      .expect(200);

    const { body: remaining } = await request(app.getHttpServer())
      .get(`/workspaces/${auth.activeWorkspace.id}/repositories`)
      .set(authHeader(auth.accessToken))
      .expect(200);

    expect(remaining).toHaveLength(0);
  });
});
