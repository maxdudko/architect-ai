'use client';

import Link from 'next/link';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  Skeleton,
} from '@/shared/components';
import { useConversationsQuery } from '@/features/chat/services/chat.service';
import { formatRelativeTime, getRecentItems } from '../utils/dashboard';

const MAX_VISIBLE_CONVERSATIONS = 5;

interface ConversationsWidgetProps {
  workspaceId: string;
}

export function ConversationsWidget({ workspaceId }: ConversationsWidgetProps) {
  const query = useConversationsQuery(workspaceId);

  if (query.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conversations</CardTitle>
          <CardDescription>Recent AI onboarding assistant sessions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (query.isError) {
    return (
      <ErrorState
        title="Unable to load conversations"
        description="Something went wrong while fetching your conversations."
        action={
          <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
            Retry
          </Button>
        }
      />
    );
  }

  const conversations = query.data ?? [];

  if (conversations.length === 0) {
    return (
      <EmptyState
        title="Conversations"
        description="No conversations yet. Start a chat to ask onboarding questions about your code."
        action={
          <Button asChild size="sm">
            <Link href="/chat">Start a conversation</Link>
          </Button>
        }
      />
    );
  }

  const recentConversations = getRecentItems(conversations, MAX_VISIBLE_CONVERSATIONS);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Conversations</CardTitle>
        <CardDescription>Recent AI onboarding assistant sessions.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <ul className="space-y-2">
          {recentConversations.map((conversation) => (
            <li key={conversation.id}>
              <Link
                href="/chat"
                className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 transition-colors hover:bg-muted/40"
              >
                <span className="truncate text-sm font-medium">
                  {conversation.title || 'Untitled chat'}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatRelativeTime(conversation.updatedAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {conversations.length > MAX_VISIBLE_CONVERSATIONS ? (
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link href="/chat">View all {conversations.length} conversations</Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
