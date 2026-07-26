'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '@/shared/components';
import { updateConversationSchema } from '../schemas/chat.schema';

type CreateConversationDialogProps = {
  isPending?: boolean;
  onCreate: (title: string) => Promise<void>;
};

export function CreateConversationDialog({
  isPending = false,
  onCreate,
}: CreateConversationDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      const frame = window.requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
      return () => window.cancelAnimationFrame(frame);
    }
  }, [open]);

  function reset() {
    setTitle('');
    setError(null);
  }

  async function handleSubmit() {
    const parsed = updateConversationSchema.safeParse({ title });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Enter a conversation name.');
      return;
    }

    await onCreate(parsed.data.title);
    setOpen(false);
    reset();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          reset();
        }
      }}
    >
      <Button className="w-full" onClick={() => setOpen(true)} disabled={isPending}>
        New chat
      </Button>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New conversation</DialogTitle>
          <DialogDescription>
            Give this chat a name so you can find it later in the sidebar.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <label htmlFor="conversation-title" className="text-xs font-medium text-muted-foreground">
            Name
          </label>
          <Input
            id="conversation-title"
            ref={inputRef}
            value={title}
            maxLength={200}
            disabled={isPending}
            placeholder="e.g. Auth flow questions"
            aria-invalid={Boolean(error)}
            onChange={(event) => {
              setTitle(event.target.value);
              if (error) {
                setError(null);
              }
            }}
          />
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !title.trim()}>
              {isPending ? 'Creating…' : 'Create chat'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
