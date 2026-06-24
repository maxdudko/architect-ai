import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { WorkspaceRole } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  assertAuthSession,
  assertOwnerWorkspace,
  authHeader,
  signUp,
  switchActiveWorkspace,
} from './helpers/factories';
import {
  closeE2eApp,
  createE2eApp,
  resetDatabase,
  runMigrations,
} from './helpers/e2e-app';

const databaseUrl = process.env.DATABASE_URL;
const describeE2e = databaseUrl ? describe : describe.skip;

describeE2e('Workspaces (e2e)', () => {
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

  it('creates a personal workspace with owner role on sign-up', async () => {
    const auth = await signUp(app);

    assertOwnerWorkspace(auth);
    expect(auth.activeWorkspace.name).toContain('Workspace');
  });

  it('lists all workspaces the user belongs to', async () => {
    const auth = await signUp(app);

    const { body: teamWorkspace } = await request(app.getHttpServer())
      .post('/workspaces')
      .set(authHeader(auth.accessToken))
      .send({ name: 'Platform Team' })
      .expect(201);

    const { body: workspaces } = await request(app.getHttpServer())
      .get('/workspaces')
      .set(authHeader(auth.accessToken))
      .expect(200);

    expect(workspaces).toHaveLength(2);
    expect(workspaces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: auth.activeWorkspace.id,
          role: WorkspaceRole.OWNER,
        }),
        expect.objectContaining({
          id: teamWorkspace.id,
          name: 'Platform Team',
          role: WorkspaceRole.OWNER,
        }),
      ]),
    );
  });

  it('assigns owner role when creating a new workspace', async () => {
    const auth = await signUp(app);

    const { body: workspace } = await request(app.getHttpServer())
      .post('/workspaces')
      .set(authHeader(auth.accessToken))
      .send({ name: 'Engineering' })
      .expect(201);

    const membership = await prisma.membership.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: auth.user.id,
        },
      },
    });

    expect(membership?.role).toBe(WorkspaceRole.OWNER);
    expect(membership?.status).toBe('ACTIVE');
  });

  it('switches active workspace and reflects it in /auth/me', async () => {
    const auth = await signUp(app);

    const { body: teamWorkspace } = await request(app.getHttpServer())
      .post('/workspaces')
      .set(authHeader(auth.accessToken))
      .send({ name: 'Switched Team' })
      .expect(201);

    const switched = await switchActiveWorkspace(
      app,
      auth.accessToken,
      teamWorkspace.id,
      auth.refreshToken,
    );

    expect(switched.activeWorkspace.id).toBe(teamWorkspace.id);
    expect(switched.activeWorkspace.name).toBe('Switched Team');
    expect(switched.activeWorkspace.role).toBe(WorkspaceRole.OWNER);

    const { body: session } = await request(app.getHttpServer())
      .get('/auth/me')
      .set(authHeader(switched.accessToken))
      .expect(200);

    assertAuthSession(session);
    expect(session.activeWorkspace.id).toBe(teamWorkspace.id);
  });

  it('rejects switching to a workspace the user does not belong to', async () => {
    const owner = await signUp(app);
    const outsider = await signUp(app);

    await request(app.getHttpServer())
      .post(`/workspaces/${owner.activeWorkspace.id}/switch`)
      .set(authHeader(outsider.accessToken))
      .send({ refreshToken: outsider.refreshToken })
      .expect(403);
  });

  it('allows owners to update workspace settings', async () => {
    const auth = await signUp(app);

    const { body: updated } = await request(app.getHttpServer())
      .patch(`/workspaces/${auth.activeWorkspace.id}`)
      .set(authHeader(auth.accessToken))
      .send({ name: 'Renamed Workspace' })
      .expect(200);

    expect(updated.name).toBe('Renamed Workspace');
    expect(updated.slug).toBe('renamed-workspace');
  });

  it('rejects workspace updates from members without admin privileges', async () => {
    const owner = await signUp(app);

    const member = await signUp(app);
    await prisma.membership.create({
      data: {
        workspaceId: owner.activeWorkspace.id,
        userId: member.user.id,
        role: WorkspaceRole.MEMBER,
        status: 'ACTIVE',
      },
    });

    await request(app.getHttpServer())
      .patch(`/workspaces/${owner.activeWorkspace.id}`)
      .set(authHeader(member.accessToken))
      .send({ name: 'Forbidden Rename' })
      .expect(403);
  });
});
