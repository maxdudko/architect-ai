import type {
  ArchitectureModuleDetail,
  ArchitectureSearchAnswer,
  ArchitectureSearchThread,
  DependencyEvidence,
  DependencyMap,
} from '@/entities';
import { parseSseChunk } from '@/features/chat/hooks/parse-sse';
import { loadAuthState } from '@/lib/auth/storage';
import { apiClient } from './axios';

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? 'http://localhost:5000';

function architectureBasePath(workspaceId: string, repositoryId: string): string {
  return `/workspaces/${workspaceId}/repositories/${repositoryId}/architecture/dependency-map`;
}

function searchBasePath(workspaceId: string, repositoryId: string): string {
  return `/workspaces/${workspaceId}/repositories/${repositoryId}/architecture/search`;
}

export async function getDependencyMap(
  workspaceId: string,
  repositoryId: string,
): Promise<DependencyMap> {
  const { data } = await apiClient.get<DependencyMap>(
    architectureBasePath(workspaceId, repositoryId),
  );
  return data;
}

export async function getArchitectureModule(
  workspaceId: string,
  repositoryId: string,
  key: string,
): Promise<ArchitectureModuleDetail> {
  const { data } = await apiClient.get<ArchitectureModuleDetail>(
    `${architectureBasePath(workspaceId, repositoryId)}/module`,
    { params: { key } },
  );
  return data;
}

export async function getDependencyEvidence(
  workspaceId: string,
  repositoryId: string,
  from: string,
  to: string,
): Promise<DependencyEvidence> {
  const { data } = await apiClient.get<DependencyEvidence>(
    `${architectureBasePath(workspaceId, repositoryId)}/evidence`,
    { params: { from, to } },
  );
  return data;
}

export async function getArchitectureSearch(
  workspaceId: string,
  repositoryId: string,
): Promise<ArchitectureSearchThread> {
  const { data } = await apiClient.get<ArchitectureSearchThread>(
    searchBasePath(workspaceId, repositoryId),
  );
  return data;
}

export async function askArchitectureSearch(
  workspaceId: string,
  repositoryId: string,
  content: string,
): Promise<ArchitectureSearchAnswer> {
  const { data } = await apiClient.post<ArchitectureSearchAnswer>(
    `${searchBasePath(workspaceId, repositoryId)}/messages`,
    { content },
  );
  return data;
}

export type ArchitectureSearchStreamHandlers = {
  onRevision?: (revision: ArchitectureSearchAnswer['revision'], rebuildInProgress: boolean) => void;
  onFindings?: (answer: Partial<ArchitectureSearchAnswer>) => void;
  onSources?: (sources: ArchitectureSearchAnswer['retrievedEvidence']) => void;
  onToken?: (text: string) => void;
  onMessage?: (answer: ArchitectureSearchAnswer) => void;
  onError?: (message: string) => void;
  onDone?: () => void;
};

export async function streamArchitectureSearch(
  workspaceId: string,
  repositoryId: string,
  content: string,
  handlers: ArchitectureSearchStreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const token = loadAuthState()?.accessToken;
  const response = await fetch(
    `${apiBaseUrl}${searchBasePath(workspaceId, repositoryId)}/messages/stream`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ content }),
      credentials: 'include',
      signal,
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    let message = 'Architecture search could not answer that question.';
    try {
      const parsed = JSON.parse(errorText) as {
        error?: { message?: string | string[] };
      };
      const nested = parsed.error?.message;
      if (typeof nested === 'string' && nested.trim()) {
        message = nested;
      } else if (Array.isArray(nested) && typeof nested[0] === 'string') {
        message = nested[0];
      }
    } catch {
      if (errorText.trim()) {
        message = errorText;
      }
    }
    throw new Error(message);
  }

  if (!response.body) {
    throw new Error('Architecture search returned an empty response.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const dispatchChunk = (chunk: string) => {
    for (const parsed of parseSseChunk(`${chunk}\n\n`)) {
      const payload = parsed.data as Record<string, unknown>;
      switch (parsed.event) {
        case 'revision':
          handlers.onRevision?.(
            payload.revision as ArchitectureSearchAnswer['revision'],
            Boolean(payload.rebuildInProgress),
          );
          break;
        case 'findings':
          handlers.onFindings?.(payload as Partial<ArchitectureSearchAnswer>);
          break;
        case 'sources':
          handlers.onSources?.(
            (payload.sources as ArchitectureSearchAnswer['retrievedEvidence']) ?? [],
          );
          break;
        case 'token':
          handlers.onToken?.(String(payload.text ?? ''));
          break;
        case 'message':
          handlers.onMessage?.(payload.answer as ArchitectureSearchAnswer);
          break;
        case 'error':
          handlers.onError?.(String(payload.message ?? 'Architecture search failed.'));
          break;
        case 'done':
          handlers.onDone?.();
          break;
        default:
          break;
      }
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      buffer += decoder.decode();
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split('\n\n');
    buffer = chunks.pop() ?? '';
    for (const chunk of chunks) {
      dispatchChunk(chunk);
    }
  }

  if (buffer.trim()) {
    dispatchChunk(buffer);
  }
}
