import { createHash } from 'node:crypto';
import { ChunkVectorPayload } from '../types/chunk-vector-payload.type';
import { ScoredChunkCandidate } from '../types/scored-chunk-candidate.type';
import { VectorSearchHit } from '../types/vector-search-hit.type';

const PAYLOAD_FIELDS = [
  'workspaceId',
  'repositoryId',
  'indexingRunId',
  'chunkId',
  'symbolId',
  'fileId',
  'filePath',
  'symbolName',
  'qualifiedName',
  'symbolType',
  'language',
  'branch',
  'createdAt',
] as const;

export function payloadFieldSelector(): string[] {
  return [...PAYLOAD_FIELDS];
}

export function asPayloadRecord(
  payload: ChunkVectorPayload,
): Record<string, unknown> {
  return { ...payload };
}

export function hitToCandidate(hit: VectorSearchHit): ScoredChunkCandidate {
  const payload = hit.payload;
  return {
    chunkId: requiredString(payload.chunkId, hit.id),
    score: hit.score,
    workspaceId: requiredString(payload.workspaceId),
    repositoryId: requiredString(payload.repositoryId),
    fileId: optionalString(payload.fileId),
    symbolId: optionalString(payload.symbolId),
    filePath: requiredString(payload.filePath),
    symbolName: optionalString(payload.symbolName),
    qualifiedName: optionalString(payload.qualifiedName),
    symbolType: optionalString(payload.symbolType),
    language: optionalString(payload.language),
    branch: requiredString(payload.branch),
    createdAt: optionalString(payload.createdAt),
  };
}

export function buildQueryEmbeddingCacheKey(
  model: string,
  query: string,
): string {
  const digest = createHash('sha256').update(`${model}:${query}`).digest('hex');
  return `retrieval:query-embedding:${digest}`;
}

export function buildContextCacheKey(
  workspaceId: string,
  query: string,
  filters: Record<string, unknown>,
): string {
  const digest = createHash('sha256')
    .update(JSON.stringify({ workspaceId, query, filters }))
    .digest('hex');
  return `retrieval:context:${digest}`;
}

function requiredString(value: unknown, fallback = ''): string {
  const parsed = optionalString(value);
  return parsed ?? fallback;
}

function optionalString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return null;
}
