'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ChatMessage, ChatSourceReference } from '@/entities';
import { streamChatMessage } from '@/lib/api';
import { CHAT_QUERY_KEYS } from '../services/chat.service';

export function useChatStream(workspaceId: string, conversationId: string) {
  const queryClient = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [pendingSources, setPendingSources] = useState<ChatSourceReference[]>([]);
  const [error, setError] = useState<string | null>(null);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }, []);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      abortRef.current = null;
    },
    [],
  );

  const send = useCallback(
    async (content: string) => {
      if (!workspaceId || !conversationId || !content.trim()) {
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsStreaming(true);
      setStreamingContent('');
      setPendingSources([]);
      setError(null);

      const optimisticUser: ChatMessage = {
        id: `temp-user-${Date.now()}`,
        conversationId,
        role: 'USER',
        content,
        metadata: null,
        createdAt: new Date().toISOString(),
      };

      queryClient.setQueryData(
        CHAT_QUERY_KEYS.detail(workspaceId, conversationId),
        (current: { messages?: ChatMessage[] } | undefined) => {
          if (!current) {
            return current;
          }
          return {
            ...current,
            messages: [...(current.messages ?? []), optimisticUser],
          };
        },
      );

      try {
        await streamChatMessage(
          workspaceId,
          conversationId,
          { content },
          {
            onToken: (text) => {
              setStreamingContent((previous) => previous + text);
            },
            onSources: (sources) => {
              setPendingSources(sources);
            },
            onMessage: ({ userMessage, assistantMessage }) => {
              queryClient.setQueryData(
                CHAT_QUERY_KEYS.detail(workspaceId, conversationId),
                (current: { messages?: ChatMessage[] } | undefined) => {
                  if (!current) {
                    return current;
                  }
                  const withoutOptimistic = (current.messages ?? []).filter(
                    (message) => message.id !== optimisticUser.id,
                  );
                  return {
                    ...current,
                    messages: [...withoutOptimistic, userMessage, assistantMessage],
                  };
                },
              );
              setStreamingContent('');
              setPendingSources([]);
            },
            onError: (message) => {
              setError(message);
              queryClient.setQueryData(
                CHAT_QUERY_KEYS.detail(workspaceId, conversationId),
                (current: { messages?: ChatMessage[] } | undefined) => {
                  if (!current) {
                    return current;
                  }
                  return {
                    ...current,
                    messages: (current.messages ?? []).filter(
                      (messageItem) => messageItem.id !== optimisticUser.id,
                    ),
                  };
                },
              );
            },
            onDone: () => {
              setIsStreaming(false);
              void queryClient.invalidateQueries({
                queryKey: CHAT_QUERY_KEYS.list(workspaceId),
              });
            },
          },
          controller.signal,
        );
      } catch (streamError) {
        if ((streamError as Error).name !== 'AbortError') {
          setError(
            streamError instanceof Error ? streamError.message : 'Failed to stream response',
          );
          queryClient.setQueryData(
            CHAT_QUERY_KEYS.detail(workspaceId, conversationId),
            (current: { messages?: ChatMessage[] } | undefined) => {
              if (!current) {
                return current;
              }
              return {
                ...current,
                messages: (current.messages ?? []).filter(
                  (messageItem) => messageItem.id !== optimisticUser.id,
                ),
              };
            },
          );
        }
      } finally {
        // The stream can close without a `done` event; clear the flag unless a
        // newer send() has already taken over.
        if (abortRef.current === controller) {
          abortRef.current = null;
          setIsStreaming(false);
        }
      }
    },
    [conversationId, queryClient, workspaceId],
  );

  return {
    send,
    cancel,
    isStreaming,
    streamingContent,
    pendingSources,
    error,
  };
}
