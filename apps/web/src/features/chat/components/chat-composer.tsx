'use client';

import { FormEvent, KeyboardEvent, useState } from 'react';
import { Button, Textarea } from '@/shared/components';

export function ChatComposer({
  disabled,
  isStreaming,
  onSend,
  onCancel,
}: {
  disabled?: boolean;
  isStreaming?: boolean;
  onSend: (content: string) => Promise<void> | void;
  onCancel?: () => void;
}) {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit() {
    const trimmed = content.trim();
    if (!trimmed || disabled || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSend(trimmed);
      setContent('');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // isComposing keeps Enter from sending while an IME candidate is being confirmed.
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border-t p-4">
      <div className="flex gap-2">
        <Textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about this codebase... (Enter to send, Shift+Enter for a new line)"
          rows={2}
          disabled={disabled || isSubmitting}
          className="min-h-[64px] resize-none"
        />

        {isStreaming ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            Stop
          </Button>
        ) : (
          <Button type="submit" disabled={disabled || isSubmitting || !content.trim()}>
            Send
          </Button>
        )}
      </div>
    </form>
  );
}
