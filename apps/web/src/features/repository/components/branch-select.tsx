'use client';

import { useEffect, useMemo } from 'react';
import { isAxiosError } from 'axios';
import { cn } from '@/lib/utils';
import { useGithubRepositoryBranchesQuery } from '../services/repository.service';

const GITHUB_RECONNECT_REQUIRED_CODE = 'GITHUB_RECONNECT_REQUIRED';

function isGithubReconnectRequired(error: unknown): boolean {
  if (!isAxiosError(error)) {
    return false;
  }

  const payload = error.response?.data as
    | { error?: { code?: string; message?: string } | string }
    | undefined;
  if (!payload || !payload.error || typeof payload.error === 'string') {
    return false;
  }

  return payload.error.code === GITHUB_RECONNECT_REQUIRED_CODE;
}

interface BranchSelectProps {
  workspaceId: string;
  externalId: string;
  defaultBranch: string;
  value: string;
  onChange: (branch: string) => void;
  enabled?: boolean;
  disabled?: boolean;
  id?: string;
  onReconnectRequired?: () => void;
  onReadyChange?: (ready: boolean) => void;
}

export function BranchSelect({
  workspaceId,
  externalId,
  defaultBranch,
  value,
  onChange,
  enabled = true,
  disabled = false,
  id,
  onReconnectRequired,
  onReadyChange,
}: BranchSelectProps) {
  const branchesQuery = useGithubRepositoryBranchesQuery(workspaceId, externalId, {
    enabled: enabled && Boolean(workspaceId) && Boolean(externalId),
  });

  const reconnectRequired =
    Boolean(branchesQuery.error) && isGithubReconnectRequired(branchesQuery.error);

  useEffect(() => {
    if (!reconnectRequired) {
      return;
    }
    onReconnectRequired?.();
  }, [reconnectRequired, onReconnectRequired]);

  const branchOptions = useMemo(() => {
    const branches = branchesQuery.data?.branches ?? [];
    const names = new Set(branches.map((branch) => branch.name));
    if (defaultBranch && !names.has(defaultBranch)) {
      return [{ name: defaultBranch, isProtected: false }, ...branches];
    }
    return branches;
  }, [branchesQuery.data?.branches, defaultBranch]);

  useEffect(() => {
    if (!branchesQuery.isSuccess || branchOptions.length === 0) {
      return;
    }
    const hasSelected = branchOptions.some((branch) => branch.name === value);
    if (!hasSelected) {
      onChange(defaultBranch || branchOptions[0].name);
    }
  }, [branchOptions, branchesQuery.isSuccess, defaultBranch, onChange, value]);

  const isReady = branchesQuery.isSuccess && branchOptions.length > 0 && !reconnectRequired;

  useEffect(() => {
    onReadyChange?.(isReady);
  }, [isReady, onReadyChange]);

  if (branchesQuery.isLoading) {
    return <p className="text-xs text-muted-foreground">Loading branches…</p>;
  }

  if (reconnectRequired) {
    return (
      <p className="text-xs text-destructive">
        GitHub authorization expired. Please reconnect GitHub.
      </p>
    );
  }

  if (branchesQuery.isError) {
    return <p className="text-xs text-destructive">Unable to load branches.</p>;
  }

  if (branchOptions.length === 0) {
    return <p className="text-xs text-muted-foreground">No branches found for this repository.</p>;
  }

  return (
    <select
      id={id}
      value={value}
      disabled={disabled || !isReady}
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
      )}
    >
      {branchOptions.map((branch) => (
        <option key={branch.name} value={branch.name}>
          {branch.name}
          {branch.name === defaultBranch ? ' (default)' : ''}
          {branch.isProtected ? ' · protected' : ''}
        </option>
      ))}
    </select>
  );
}
