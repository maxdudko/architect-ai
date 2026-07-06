'use client';

interface RepositoryErrorTextProps {
  message: string | null;
}

export function RepositoryErrorText({ message }: RepositoryErrorTextProps) {
  if (!message) {
    return null;
  }

  return <p className="mt-1 text-xs text-destructive">{message}</p>;
}
