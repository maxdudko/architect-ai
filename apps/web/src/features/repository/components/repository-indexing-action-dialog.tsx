'use client';

import { useCallback, useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components';
import { BranchSelect } from './branch-select';

interface RepositoryIndexingActionDialogProps {
  triggerLabel: string;
  title: string;
  description: string;
  workspaceId: string;
  externalId: string;
  defaultBranch: string;
  isPending: boolean;
  onSubmit: (branch?: string) => Promise<void>;
  onReconnectRequired?: () => void;
}

export function RepositoryIndexingActionDialog({
  triggerLabel,
  title,
  description,
  workspaceId,
  externalId,
  defaultBranch,
  isPending,
  onSubmit,
  onReconnectRequired,
}: RepositoryIndexingActionDialogProps) {
  const [open, setOpen] = useState(false);
  const [branch, setBranch] = useState(defaultBranch);
  const [branchReady, setBranchReady] = useState(false);

  const onReadyChange = useCallback((ready: boolean) => {
    setBranchReady(ready);
  }, []);

  const onActionSubmit = async () => {
    if (!branchReady) {
      return;
    }
    const normalizedBranch = branch.trim();
    await onSubmit(
      normalizedBranch && normalizedBranch !== defaultBranch ? normalizedBranch : undefined,
    );
    setOpen(false);
    setBranch(defaultBranch);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setBranch(defaultBranch);
          setBranchReady(false);
        } else {
          setBranch(defaultBranch);
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
          <label htmlFor={`index-branch-${externalId}`} className="text-sm font-medium">
            Branch
          </label>
          <BranchSelect
            id={`index-branch-${externalId}`}
            workspaceId={workspaceId}
            externalId={externalId}
            defaultBranch={defaultBranch}
            value={branch}
            onChange={setBranch}
            enabled={open}
            disabled={isPending}
            onReconnectRequired={onReconnectRequired}
            onReadyChange={onReadyChange}
          />
          <p className="text-xs text-muted-foreground">
            Leave the default branch selected to use {defaultBranch}.
          </p>
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
            disabled={isPending || !branchReady}
          >
            {triggerLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
