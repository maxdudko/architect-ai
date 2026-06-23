import { Skeleton } from '@/shared/components';

export default function Loading() {
  return (
    <main className="space-y-4 p-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </main>
  );
}
