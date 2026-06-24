import { WorkspaceRole } from '@prisma/client';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import type { AuthResponse } from '../../src/auth/interfaces/auth-response.interface';

export const TEST_PASSWORD = 'Password123!';

export interface SignUpPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface HttpExceptionBody {
  statusCode: number;
  error: {
    message: string;
    statusCode: number;
  };
  path: string;
  timestamp: string;
}

export function uniqueEmail(prefix = 'user'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@architect.ai.test`;
}

export function buildSignUpPayload(
  overrides: Partial<SignUpPayload> = {},
): SignUpPayload {
  return {
    email: uniqueEmail(),
    password: TEST_PASSWORD,
    firstName: 'Test',
    lastName: 'User',
    ...overrides,
  };
}

export function authHeader(accessToken: string): { Authorization: string } {
  return { Authorization: `Bearer ${accessToken}` };
}

export type AuthSession = Pick<
  AuthResponse,
  'user' | 'workspaces' | 'activeWorkspace'
>;

export function assertTokenPair(body: unknown): asserts body is {
  accessToken: string;
  refreshToken: string;
} {
  if (!body || typeof body !== 'object') {
    throw new Error('Expected token pair body');
  }

  const tokens = body as { accessToken: unknown; refreshToken: unknown };
  expect(typeof tokens.accessToken).toBe('string');
  expect(typeof tokens.refreshToken).toBe('string');
}

export function assertAuthResponse(
  body: unknown,
): asserts body is AuthResponse {
  if (!body || typeof body !== 'object') {
    throw new Error('Expected auth response body');
  }

  const response = body as AuthResponse;

  expect(typeof response.accessToken).toBe('string');
  expect(typeof response.refreshToken).toBe('string');
  expect(response.user).toMatchObject({
    id: expect.any(String),
    email: expect.any(String),
    firstName: expect.any(String),
    lastName: expect.any(String),
    emailVerified: expect.any(Boolean),
  });
  expect(response.workspaces.length).toBeGreaterThan(0);
  expect(response.activeWorkspace).toMatchObject({
    id: expect.any(String),
    name: expect.any(String),
    slug: expect.any(String),
    role: expect.any(String),
  });
}

export function assertAuthSession(body: unknown): asserts body is AuthSession {
  if (!body || typeof body !== 'object') {
    throw new Error('Expected auth session body');
  }

  const session = body as AuthSession;

  expect(session.user).toMatchObject({
    id: expect.any(String),
    email: expect.any(String),
    firstName: expect.any(String),
    lastName: expect.any(String),
    emailVerified: expect.any(Boolean),
  });
  expect(session.workspaces.length).toBeGreaterThan(0);
  expect(session.activeWorkspace).toMatchObject({
    id: expect.any(String),
    name: expect.any(String),
    slug: expect.any(String),
    role: expect.any(String),
  });
}

export function assertOwnerWorkspace(body: AuthResponse): void {
  expect(body.activeWorkspace.role).toBe(WorkspaceRole.OWNER);
  expect(body.workspaces[0].role).toBe(WorkspaceRole.OWNER);
}

export function assertErrorMessageContains(
  body: unknown,
  substring: string,
): void {
  if (!body || typeof body !== 'object' || !('error' in body)) {
    throw new Error('Expected HTTP exception body');
  }

  const { error } = body as HttpExceptionBody;
  expect(error.message).toContain(substring);
}

export async function signUp(
  app: INestApplication,
  payload = buildSignUpPayload(),
): Promise<AuthResponse> {
  const { body } = await request(app.getHttpServer())
    .post('/auth/signup')
    .send(payload)
    .expect(201);

  assertAuthResponse(body);
  return body;
}

export interface RepositoryPayload {
  provider: 'GITHUB' | 'GITLAB' | 'BITBUCKET';
  externalId: string;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch?: string;
}

export function buildRepositoryPayload(
  overrides: Partial<RepositoryPayload> = {},
): RepositoryPayload {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    provider: 'GITHUB',
    externalId: suffix,
    owner: 'acme',
    name: 'platform-api',
    fullName: `acme/platform-api-${suffix}`,
    defaultBranch: 'main',
    ...overrides,
  };
}

export interface RepositoryResponse {
  id: string;
  workspaceId: string;
  provider: string;
  externalId: string;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  status: string;
}

export function assertRepository(
  body: unknown,
): asserts body is RepositoryResponse {
  if (!body || typeof body !== 'object') {
    throw new Error('Expected repository body');
  }

  const repository = body as RepositoryResponse;
  expect(typeof repository.id).toBe('string');
  expect(typeof repository.workspaceId).toBe('string');
  expect(typeof repository.fullName).toBe('string');
}

export async function connectRepository(
  app: INestApplication,
  accessToken: string,
  workspaceId: string,
  payload = buildRepositoryPayload(),
): Promise<RepositoryResponse> {
  const { body } = await request(app.getHttpServer())
    .post(`/workspaces/${workspaceId}/repositories`)
    .set(authHeader(accessToken))
    .send(payload)
    .expect(201);

  assertRepository(body);
  return body;
}

export async function switchActiveWorkspace(
  app: INestApplication,
  accessToken: string,
  workspaceId: string,
  refreshToken: string,
): Promise<{
  accessToken: string;
  refreshToken: string;
  activeWorkspace: AuthResponse['activeWorkspace'];
}> {
  const { body } = await request(app.getHttpServer())
    .post(`/workspaces/${workspaceId}/switch`)
    .set(authHeader(accessToken))
    .send({ refreshToken })
    .expect(201);

  if (!body || typeof body !== 'object') {
    throw new Error('Expected workspace switch response');
  }

  const response = body as {
    accessToken: unknown;
    refreshToken: unknown;
    activeWorkspace: unknown;
  };

  assertTokenPair(response);
  if (
    !response.activeWorkspace ||
    typeof response.activeWorkspace !== 'object'
  ) {
    throw new Error('Expected active workspace in switch response');
  }

  return response as {
    accessToken: string;
    refreshToken: string;
    activeWorkspace: AuthResponse['activeWorkspace'];
  };
}
