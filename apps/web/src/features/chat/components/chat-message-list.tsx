'use client';

import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { AnswerFeedbackRating, ChatMessage, ChatSourceReference } from '@/entities';
import { submitAnswerFeedback } from '@/lib/api';
import { Button } from '@/shared/components';

function formatSource(source: ChatSourceReference): string {
  const lineRange =
    source.startLine != null && source.endLine != null
      ? `:${source.startLine}-${source.endLine}`
      : '';
  return `${source.filePath}${lineRange}`;
}

function AnswerFeedbackControls({
  workspaceId,
  conversationId,
  message,
  onRated,
}: {
  workspaceId: string;
  conversationId: string;
  message: ChatMessage;
  onRated: (messageId: string, rating: AnswerFeedbackRating) => void;
}) {
  const [pending, setPending] = useState<AnswerFeedbackRating | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function rate(rating: AnswerFeedbackRating) {
    if (pending) {
      return;
    }
    setPending(rating);
    setError(null);
    try {
      await submitAnswerFeedback(workspaceId, conversationId, message.id, rating);
      onRated(message.id, rating);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save feedback');
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-2">
      <span className="text-xs text-muted-foreground">Was this helpful?</span>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className={message.feedbackRating === 'HELPFUL' ? 'text-green-500' : ''}
        disabled={pending != null}
        aria-label="Helpful"
        aria-pressed={message.feedbackRating === 'HELPFUL'}
        onClick={() => void rate('HELPFUL')}
      >
        <ThumbsUp className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className={message.feedbackRating === 'NOT_HELPFUL' ? 'text-red-500' : ''}
        disabled={pending != null}
        aria-label="Not helpful"
        aria-pressed={message.feedbackRating === 'NOT_HELPFUL'}
        onClick={() => void rate('NOT_HELPFUL')}
      >
        <ThumbsDown className="h-4 w-4" />
      </Button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}

export function ChatMessageList({
  workspaceId,
  conversationId,
  messages,
  streamingContent,
  pendingSources,
  onFeedbackRated,
}: {
  workspaceId: string;
  conversationId: string;
  messages: ChatMessage[];
  streamingContent?: string;
  pendingSources?: ChatSourceReference[];
  onFeedbackRated: (messageId: string, rating: AnswerFeedbackRating) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages.length, streamingContent]);

  return (
    <div ref={scrollRef} className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
      {messages.length === 0 && !streamingContent ? (
        <p className="text-sm text-muted-foreground">
          Ask a question about your codebase to get started.
        </p>
      ) : null}

      {messages.map((message) => {
        const sources =
          message.role === 'ASSISTANT'
            ? ((message.metadata?.sources as ChatSourceReference[] | undefined) ?? [])
            : [];

        return (
          <div
            key={message.id}
            className={
              message.role === 'USER'
                ? 'ml-auto max-w-[85%] rounded-lg bg-primary px-3 py-2 text-primary-foreground'
                : 'mr-auto max-w-[85%] rounded-lg border bg-background px-3 py-2'
            }
          >
            <p className="whitespace-pre-wrap text-sm">{message.content}</p>
            {sources.length > 0 ? (
              <div className="mt-3 border-t pt-2">
                <p className="mb-1 text-xs font-medium text-muted-foreground">Sources</p>
                <ul className="space-y-1">
                  {sources.map((source) => (
                    <li
                      key={`${source.chunkId}-${source.filePath}`}
                      className="font-mono text-xs text-muted-foreground"
                    >
                      {formatSource(source)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {message.role === 'ASSISTANT' && !message.id.startsWith('temp-') ? (
              <AnswerFeedbackControls
                workspaceId={workspaceId}
                conversationId={conversationId}
                message={message}
                onRated={onFeedbackRated}
              />
            ) : null}
          </div>
        );
      })}

      {streamingContent ? (
        <div className="mr-auto max-w-[85%] rounded-lg border bg-background px-3 py-2">
          <p className="whitespace-pre-wrap text-sm">{streamingContent}</p>
          {pendingSources && pendingSources.length > 0 ? (
            <div className="mt-3 border-t pt-2">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Sources</p>
              <ul className="space-y-1">
                {pendingSources.map((source) => (
                  <li
                    key={`${source.chunkId}-${source.filePath}`}
                    className="font-mono text-xs text-muted-foreground"
                  >
                    {formatSource(source)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
