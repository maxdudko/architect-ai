'use client';

import { useMemo, useState } from 'react';
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

const BRANCH_PATTERN = /^[A-Za-z0-9._/-]+$/;

interface RepositoryIndexingActionDialogProps {
  triggerLabel: string;
  title: string;
  description: string;
  defaultBranch: string;
  isPending: boolean;
  onSubmit: (branch?: string) => Promise<void>;
}

export function RepositoryIndexingActionDialog({
  triggerLabel,
  title,
  description,
  defaultBranch,
  isPending,
  onSubmit,
}: RepositoryIndexingActionDialogProps) {
  const [open, setOpen] = useState(false);
  const [branch, setBranch] = useState('');

  const validationMessage = useMemo(() => {
    const normalizedBranch = branch.trim();
    if (!normalizedBranch) {
      return null;
    }
    if (!BRANCH_PATTERN.test(normalizedBranch)) {
      return 'Branch contains invalid characters.';
    }
    return null;
  }, [branch]);

  const onActionSubmit = async () => {
    const normalizedBranch = branch.trim();
    if (validationMessage) {
      return;
    }
    await onSubmit(normalizedBranch || undefined);
    setOpen(false);
    setBranch('');
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setBranch('');
        }
      }}
    >
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} disabled={isPending}>
        {triggerLabel}
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Input
            value={branch}
            onChange={(event) => setBranch(event.target.value)}
            placeholder={`Optional branch override (default: ${defaultBranch})`}
          />
          {validationMessage ? (
            <p className="text-xs text-destructive">{validationMessage}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Leave blank to use the default branch ({defaultBranch}).
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              void onActionSubmit();
            }}
            disabled={isPending || Boolean(validationMessage)}
          >
            {triggerLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
