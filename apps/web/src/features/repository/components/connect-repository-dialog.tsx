'use client';

import { useCallback, useState } from 'react';
import type { GithubRepositorySummary } from '@/entities';
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

interface ConnectRepositoryDialogProps {
  repository: GithubRepositorySummary;
  workspaceId: string;
  isPending: boolean;
  onConnect: (branch: string) => Promise<void>;
  onReconnectRequired?: () => void;
}

export function ConnectRepositoryDialog({
  repository,
  workspaceId,
  isPending,
  onConnect,
  onReconnectRequired,
}: ConnectRepositoryDialogProps) {
  const [open, setOpen] = useState(false);
  const [branch, setBranch] = useState(repository.defaultBranch);
  const [branchReady, setBranchReady] = useState(false);

  const onReadyChange = useCallback((ready: boolean) => {
    setBranchReady(ready);
  }, []);

  const onConfirm = async () => {
    if (!branchReady || !branch) {
      return;
    }
    try {
      await onConnect(branch);
      setOpen(false);
    } catch {
      // Parent surfaces the error; keep dialog open for retry.
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setBranch(repository.defaultBranch);
          setBranchReady(false);
        }
      }}
    >
      <Button
        type="button"
        size="sm"
        disabled={isPending || !repository.connectable}
        onClick={() => setOpen(true)}
      >
        {repository.connectable ? 'Connect' : 'Already connected'}
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect {repository.fullName}</DialogTitle>
          <DialogDescription>
            Choose which branch to index for this repository.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label htmlFor={`connect-branch-${repository.id}`} className="text-sm font-medium">
            Branch
          </label>
          <BranchSelect
            id={`connect-branch-${repository.id}`}
            workspaceId={workspaceId}
            externalId={repository.id}
            defaultBranch={repository.defaultBranch}
            value={branch}
            onChange={setBranch}
            enabled={open}
            disabled={isPending}
            onReconnectRequired={onReconnectRequired}
            onReadyChange={onReadyChange}
          />
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
              void onConfirm();
            }}
            disabled={isPending || !branchReady || !branch}
          >
            Connect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
