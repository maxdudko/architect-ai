import type { RequestContextCarrier } from '../interfaces/request-context.interface';

export interface RequestLogContext {
  requestId: string | null;
  userId: string | null;
  organizationId: string | null;
  repositoryId: string | null;
  method: string | null;
  route: string | null;
}

export function resolveRequestLogContext(
  request: RequestContextCarrier | undefined,
): RequestLogContext {
  if (!request) {
    return {
      requestId: null,
      userId: null,
      organizationId: null,
      repositoryId: null,
      method: null,
      route: null,
    };
  }

  const repositoryId = resolveRepositoryId(request);
  return {
    requestId: request.requestId ?? resolveHeader(request, 'x-request-id'),
    userId: request.user?.sub ?? null,
    organizationId:
      request.workspace?.id ?? request.user?.activeWorkspaceId ?? null,
    repositoryId,
    method: request.method ?? null,
    route: request.originalUrl ?? request.path ?? null,
  };
}

function resolveRepositoryId(request: RequestContextCarrier): string | null {
  const fromParams = request.params?.repositoryId ?? request.params?.externalId;
  if (typeof fromParams === 'string' && fromParams.length > 0) {
    return fromParams;
  }
  if (Array.isArray(fromParams) && fromParams[0]) {
    return fromParams[0];
  }

  const bodyValue = request.body?.repositoryId;
  if (typeof bodyValue === 'string' && bodyValue.length > 0) {
    return bodyValue;
  }

  return null;
}

function resolveHeader(
  request: RequestContextCarrier,
  headerName: string,
): string | null {
  const header = request.headers?.[headerName];
  if (Array.isArray(header)) {
    return header[0] ?? null;
  }
  return header ?? null;
}
