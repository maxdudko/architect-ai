import type {
  AnswerFeedback,
  ChatAnswerResponse,
  Conversation,
  ConversationDetail,
  ChatSourceReference,
} from '@/entities';
import { parseSseChunk } from '@/features/chat/hooks/parse-sse';
import { loadAuthState } from '@/lib/auth/storage';
import { apiClient } from './axios';

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? 'http://localhost:5000';

export interface CreateConversationPayload {
  repositoryId?: string;
  title?: string;
}

export interface UpdateConversationPayload {
  title: string;
}

export interface CreateChatMessagePayload {
  content: string;
}

export type ChatStreamHandlers = {
  onToken?: (text: string) => void;
  onSources?: (sources: ChatSourceReference[]) => void;
  onMessage?: (payload: {
    userMessage: ChatAnswerResponse['userMessage'];
    assistantMessage: ChatAnswerResponse['assistantMessage'];
  }) => void;
  onError?: (message: string) => void;
  onDone?: () => void;
};

export async function listConversations(workspaceId: string): Promise<Conversation[]> {
  const { data } = await apiClient.get<Conversation[]>(`/workspaces/${workspaceId}/conversations`);
  return data;
}

export async function getConversation(
  workspaceId: string,
  conversationId: string,
): Promise<ConversationDetail> {
  const { data } = await apiClient.get<ConversationDetail>(
    `/workspaces/${workspaceId}/conversations/${conversationId}`,
  );
  return data;
}

export async function createConversation(
  workspaceId: string,
  payload: CreateConversationPayload = {},
): Promise<Conversation> {
  const { data } = await apiClient.post<Conversation>(
    `/workspaces/${workspaceId}/conversations`,
    payload,
  );
  return data;
}

export async function updateConversation(
  workspaceId: string,
  conversationId: string,
  payload: UpdateConversationPayload,
): Promise<Conversation> {
  const { data } = await apiClient.patch<Conversation>(
    `/workspaces/${workspaceId}/conversations/${conversationId}`,
    payload,
  );
  return data;
}

export async function deleteConversation(
  workspaceId: string,
  conversationId: string,
): Promise<{ success: boolean }> {
  const { data } = await apiClient.delete<{ success: boolean }>(
    `/workspaces/${workspaceId}/conversations/${conversationId}`,
  );
  return data;
}

export async function askChatMessage(
  workspaceId: string,
  conversationId: string,
  payload: CreateChatMessagePayload,
): Promise<ChatAnswerResponse> {
  const { data } = await apiClient.post<ChatAnswerResponse>(
    `/workspaces/${workspaceId}/conversations/${conversationId}/messages`,
    payload,
  );
  return data;
}

export async function submitAnswerFeedback(
  workspaceId: string,
  conversationId: string,
  messageId: string,
  rating: 'HELPFUL' | 'NOT_HELPFUL',
): Promise<AnswerFeedback> {
  const { data } = await apiClient.post<AnswerFeedback>(
    `/workspaces/${workspaceId}/conversations/${conversationId}/messages/${messageId}/feedback`,
    { rating },
  );
  return data;
}

export async function streamChatMessage(
  workspaceId: string,
  conversationId: string,
  payload: CreateChatMessagePayload,
  handlers: ChatStreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const token = loadAuthState()?.accessToken;
  const response = await fetch(
    `${apiBaseUrl}/workspaces/${workspaceId}/conversations/${conversationId}/messages/stream`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
      credentials: 'include',
      signal,
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Stream failed with status ${response.status}`);
  }

  if (!response.body) {
    throw new Error('Stream response body is empty');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const dispatchChunk = (chunk: string) => {
    const events = parseSseChunk(`${chunk}\n\n`);
    for (const parsed of events) {
      const eventPayload = parsed.data as Record<string, unknown>;
      switch (parsed.event) {
        case 'token':
          handlers.onToken?.(String(eventPayload.text ?? ''));
          break;
        case 'sources':
          handlers.onSources?.((eventPayload.sources as ChatSourceReference[]) ?? []);
          break;
        case 'message':
          handlers.onMessage?.({
            userMessage: eventPayload.userMessage as ChatAnswerResponse['userMessage'],
            assistantMessage:
              eventPayload.assistantMessage as ChatAnswerResponse['assistantMessage'],
          });
          break;
        case 'error':
          handlers.onError?.(String(eventPayload.message ?? 'Stream error'));
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
