'use client';

import type { ChatMessage, ChatSourceReference } from '@/entities';

function formatSource(source: ChatSourceReference): string {
  const lineRange =
    source.startLine != null && source.endLine != null
      ? `:${source.startLine}-${source.endLine}`
      : '';
  return `${source.filePath}${lineRange}`;
}

export function ChatMessageList({
  messages,
  streamingContent,
  pendingSources,
}: {
  messages: ChatMessage[];
  streamingContent?: string;
  pendingSources?: ChatSourceReference[];
}) {
  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
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
