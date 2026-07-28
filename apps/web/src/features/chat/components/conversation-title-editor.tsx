'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, Input } from '@/shared/components';
import { updateConversationSchema } from '../schemas/chat.schema';

type ConversationTitleEditorProps = {
  title?: string | null;
  disabled?: boolean;
  isSaving?: boolean;
  onSave: (title: string) => Promise<void> | void;
  className?: string;
};

export function ConversationTitleEditor({
  title,
  disabled = false,
  isSaving = false,
  onSave,
  className,
}: ConversationTitleEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(title ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  function startEditing() {
    setDraft(title ?? '');
    setIsEditing(true);
  }

  async function commit() {
    const parsed = updateConversationSchema.safeParse({ title: draft });
    if (!parsed.success) {
      setDraft(title ?? '');
      setIsEditing(false);
      return;
    }

    if (parsed.data.title === (title ?? '').trim()) {
      setIsEditing(false);
      return;
    }

    await onSave(parsed.data.title);
    setIsEditing(false);
  }

  if (isEditing) {
    return (
      <form
        className={className}
        onSubmit={(event) => {
          event.preventDefault();
          void commit();
        }}
      >
        <Input
          ref={inputRef}
          value={draft}
          disabled={isSaving}
          maxLength={200}
          aria-label="Conversation title"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              setDraft(title ?? '');
              setIsEditing(false);
            }
          }}
        />
      </form>
    );
  }

  return (
    <div className={`flex min-w-0 items-center gap-2 ${className ?? ''}`}>
      <h2 className="truncate text-sm font-semibold">{title || 'Untitled chat'}</h2>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={disabled || isSaving}
        onClick={startEditing}
      >
        Rename
      </Button>
    </div>
  );
}
