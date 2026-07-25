'use client';

import { FormEvent, useState } from 'react';
import { Button, Textarea } from '@/shared/components';

export function ChatComposer({
  disabled,
  onSend,
}: {
  disabled?: boolean;
  onSend: (content: string) => Promise<void> | void;
}) {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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

  return (
    <form onSubmit={handleSubmit} className="border-t p-4">
      <div className="flex gap-2">
        <Textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Ask about this codebase..."
          rows={2}
          disabled={disabled || isSubmitting}
          className="min-h-[64px] resize-none"
        />
        <Button type="submit" disabled={disabled || isSubmitting || !content.trim()}>
          Send
        </Button>
      </div>
    </form>
  );
}
