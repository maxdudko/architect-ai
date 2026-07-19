'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/providers/auth-provider';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ErrorState,
  PageHeader,
  Skeleton,
} from '@/shared/components';
import {
  useRepositoryFilesQuery,
  useRepositoryQuery,
  useRepositorySymbolsQuery,
} from '../services/repository.service';
import { RepositoryStatusBadge } from './repository-status-badge';

interface RepositoryBrowseProps {
  repositoryId: string;
}

export function RepositoryBrowse({ repositoryId }: RepositoryBrowseProps) {
  const { activeWorkspace } = useAuth();
  const workspaceId = activeWorkspace?.id ?? '';
  const repositoryQuery = useRepositoryQuery(workspaceId, repositoryId);
  const filesQuery = useRepositoryFilesQuery(workspaceId, repositoryId);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);

  const files = filesQuery.data ?? [];
  const activeFilePath =
    selectedFilePath && files.some((file) => file.path === selectedFilePath)
      ? selectedFilePath
      : (files[0]?.path ?? null);

  const symbolsQuery = useRepositorySymbolsQuery(workspaceId, repositoryId, {
    filePath: activeFilePath ?? undefined,
  });

  const symbols = useMemo(
    () => (symbolsQuery.data ?? []).filter((symbol) => symbol.type !== 'MODULE'),
    [symbolsQuery.data],
  );
  if (!workspaceId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No active workspace</CardTitle>
          <CardDescription>Select a workspace to browse repositories.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (repositoryQuery.isLoading) {
    return <Skeleton className="h-40 w-full" />;
  }

  if (repositoryQuery.isError || !repositoryQuery.data) {
    return (
      <ErrorState
        title="Repository not found"
        description="This repository is unavailable in the active workspace."
        action={
          <Link href="/repositories" className="text-sm underline">
            Back to repositories
          </Link>
        }
      />
    );
  }

  const repository = repositoryQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={repository.fullName}
        description={`${repository.provider} · ${repository.defaultBranch}`}
        actions={<RepositoryStatusBadge status={repository.status} />}
      />

      {repository.status !== 'READY' ? (
        <p className="text-sm text-muted-foreground">
          Indexing is not complete yet. File and symbol inventory may be empty until the repository
          reaches Ready.
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Files</CardTitle>
            <CardDescription>
              {filesQuery.isLoading
                ? 'Loading inventory…'
                : `${files.length} indexed file${files.length === 1 ? '' : 's'}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="max-h-[28rem] space-y-1 overflow-y-auto">
            {filesQuery.isLoading ? <Skeleton className="h-16 w-full" /> : null}
            {!filesQuery.isLoading && files.length === 0 ? (
              <p className="text-sm text-muted-foreground">No indexed files yet.</p>
            ) : null}
            {files.map((file) => {
              const isSelected = activeFilePath === file.path;
              return (
                <button
                  key={file.id}
                  type="button"
                  onClick={() => setSelectedFilePath(file.path)}
                  className={`block w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    isSelected
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                  }`}
                >
                  <span className="block truncate font-medium">{file.path}</span>
                  <span className="block text-xs">
                    {file.language} · {file.lineCount} lines
                  </span>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Symbols</CardTitle>
            <CardDescription>
              {activeFilePath ? `Symbols in ${activeFilePath}` : 'Select a file to inspect symbols'}
            </CardDescription>
          </CardHeader>
          <CardContent className="max-h-[28rem] space-y-2 overflow-y-auto">
            {symbolsQuery.isLoading ? <Skeleton className="h-16 w-full" /> : null}
            {!symbolsQuery.isLoading && activeFilePath && symbols.length === 0 ? (
              <p className="text-sm text-muted-foreground">No symbols found in this file.</p>
            ) : null}
            {!activeFilePath ? (
              <p className="text-sm text-muted-foreground">Select a file from the inventory.</p>
            ) : null}
            {symbols.map((symbol) => (
              <div key={symbol.id} className="rounded-md border border-border/70 px-3 py-2">
                <p className="font-medium">{symbol.name}</p>
                <p className="text-xs text-muted-foreground">
                  {symbol.type} · L{symbol.startLine}–{symbol.endLine}
                </p>
                <p className="truncate text-xs text-muted-foreground">{symbol.qualifiedName}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Link href="/repositories" className="text-sm text-muted-foreground underline">
        Back to repositories
      </Link>
    </div>
  );
}
