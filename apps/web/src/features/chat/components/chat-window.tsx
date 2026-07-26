'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { Button, EmptyState, ErrorState, Skeleton } from '@/shared/components';
import { useRepositoriesQuery } from '@/features/repository';
import { useChatStream } from '../hooks/use-chat-stream';
import {
  useConversationQuery,
  useConversationsQuery,
  useCreateConversationMutation,
  useDeleteConversationMutation,
} from '../services/chat.service';
import { ChatComposer } from './chat-composer';
import { ChatMessageList } from './chat-message-list';

export function ChatWindow() {
  const { activeWorkspace } = useAuth();
  const workspaceId = activeWorkspace?.id ?? '';
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [selectedRepositoryId, setSelectedRepositoryId] = useState<string>('');

  const conversationsQuery = useConversationsQuery(workspaceId);
  const repositoriesQuery = useRepositoriesQuery(workspaceId);
  const createMutation = useCreateConversationMutation(workspaceId);
  const deleteMutation = useDeleteConversationMutation(workspaceId);

  const conversationId = selectedConversationId ?? '';
  const conversationQuery = useConversationQuery(workspaceId, conversationId);
  const stream = useChatStream(workspaceId, conversationId);

  const conversations = conversationsQuery.data ?? [];
  const repositories = repositoriesQuery.data ?? [];
  const messages = conversationQuery.data?.messages ?? [];

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === conversationId),
    [conversationId, conversations],
  );

  async function handleCreateConversation() {
    const conversation = await createMutation.mutateAsync({
      repositoryId: selectedRepositoryId || undefined,
      title: 'New conversation',
    });
    setSelectedConversationId(conversation.id);
  }

  async function handleDeleteConversation(id: string) {
    await deleteMutation.mutateAsync(id);
    if (selectedConversationId === id) {
      setSelectedConversationId(null);
    }
  }

  if (!workspaceId) {
    return (
      <EmptyState
        title="Select a workspace"
        description="Choose an active workspace to start chatting about your repositories."
      />
    );
  }

  if (conversationsQuery.isError) {
    return (
      <ErrorState
        title="Unable to load conversations"
        description="Please refresh and try again."
      />
    );
  }

  return (
    <div className="grid min-h-[70vh] gap-4 lg:grid-cols-[280px_1fr]">
      <aside className="flex flex-col gap-3 rounded-lg border p-3">
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Repository scope</label>
          <select
            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            value={selectedRepositoryId}
            onChange={(event) => setSelectedRepositoryId(event.target.value)}
          >
            <option value="">All repositories</option>
            {repositories.map((repository) => (
              <option key={repository.id} value={repository.id}>
                {repository.fullName}
              </option>
            ))}
          </select>
          <Button
            className="w-full"
            onClick={() => void handleCreateConversation()}
            disabled={createMutation.isPending}
          >
            New chat
          </Button>
        </div>

        <div className="flex-1 space-y-1 overflow-y-auto">
          {conversationsQuery.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : conversations.length === 0 ? (
            <p className="px-1 text-xs text-muted-foreground">No conversations yet.</p>
          ) : (
            conversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`flex items-start justify-between gap-2 rounded-md border px-2 py-2 text-left ${
                  conversation.id === selectedConversationId ? 'border-primary bg-muted/40' : ''
                }`}
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => setSelectedConversationId(conversation.id)}
                >
                  <p className="truncate text-sm font-medium">
                    {conversation.title || 'Untitled chat'}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {new Date(conversation.updatedAt).toLocaleString()}
                  </p>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleDeleteConversation(conversation.id)}
                >
                  Delete
                </Button>
              </div>
            ))
          )}
        </div>
      </aside>

      <section className="flex min-h-[70vh] flex-col rounded-lg border">
        {!selectedConversationId ? (
          <div className="flex flex-1 items-center justify-center p-6">
            <EmptyState
              title="Start a conversation"
              description="Create a new chat or select an existing one to ask onboarding questions."
            />
          </div>
        ) : (
          <>
            <div className="border-b px-4 py-3">
              <h2 className="text-sm font-semibold">
                {selectedConversation?.title || 'Conversation'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {selectedConversation?.repositoryId
                  ? 'Scoped to a repository'
                  : 'Workspace-wide retrieval'}
              </p>
            </div>

            {conversationQuery.isLoading ? (
              <div className="flex-1 p-4">
                <Skeleton className="h-24 w-full" />
              </div>
            ) : (
              <ChatMessageList
                messages={messages}
                streamingContent={stream.streamingContent}
                pendingSources={stream.pendingSources}
              />
            )}

            {stream.error ? (
              <p className="px-4 pb-2 text-sm text-destructive">{stream.error}</p>
            ) : null}

            <ChatComposer
              disabled={stream.isStreaming || conversationQuery.isLoading}
              isStreaming={stream.isStreaming}
              onSend={stream.send}
              onCancel={stream.cancel}
            />
          </>
        )}
      </section>
    </div>
  );
}
