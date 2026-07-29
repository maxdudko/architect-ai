import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Conversation, ConversationDetail } from '@/entities';
import {
  createConversation,
  deleteConversation,
  getConversation,
  listConversations,
  updateConversation,
  type CreateConversationPayload,
  type UpdateConversationPayload,
} from '@/lib/api';

export const CHAT_QUERY_KEYS = {
  list: (workspaceId: string) => ['workspaces', workspaceId, 'conversations'] as const,
  detail: (workspaceId: string, conversationId: string) =>
    ['workspaces', workspaceId, 'conversations', conversationId] as const,
};

export function useConversationsQuery(workspaceId: string) {
  return useQuery({
    queryKey: CHAT_QUERY_KEYS.list(workspaceId),
    queryFn: () => listConversations(workspaceId),
    enabled: Boolean(workspaceId),
  });
}

export function useConversationQuery(workspaceId: string, conversationId: string) {
  return useQuery({
    queryKey: CHAT_QUERY_KEYS.detail(workspaceId, conversationId),
    queryFn: () => getConversation(workspaceId, conversationId),
    enabled: Boolean(workspaceId) && Boolean(conversationId),
  });
}

export function useCreateConversationMutation(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateConversationPayload = {}) =>
      createConversation(workspaceId, payload),
    onSuccess: async (conversation: Conversation) => {
      await queryClient.invalidateQueries({
        queryKey: CHAT_QUERY_KEYS.list(workspaceId),
      });
      queryClient.setQueryData(CHAT_QUERY_KEYS.detail(workspaceId, conversation.id), {
        ...conversation,
        messages: [],
      });
    },
  });
}

export function useUpdateConversationMutation(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      conversationId,
      payload,
    }: {
      conversationId: string;
      payload: UpdateConversationPayload;
    }) => updateConversation(workspaceId, conversationId, payload),
    onSuccess: async (conversation: Conversation) => {
      queryClient.setQueryData(
        CHAT_QUERY_KEYS.list(workspaceId),
        (current: Conversation[] | undefined) =>
          current?.map((item) => (item.id === conversation.id ? conversation : item)),
      );
      queryClient.setQueryData(
        CHAT_QUERY_KEYS.detail(workspaceId, conversation.id),
        (current: ConversationDetail | undefined) =>
          current ? { ...current, ...conversation } : current,
      );
    },
  });
}

export function useDeleteConversationMutation(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => deleteConversation(workspaceId, conversationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: CHAT_QUERY_KEYS.list(workspaceId),
      });
    },
  });
}
