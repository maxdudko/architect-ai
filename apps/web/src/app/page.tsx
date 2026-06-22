import { StatusCard } from '@architect-ai/ui';
import { buildApiHealthUrl } from '@/lib/health';

export default function Home() {
  const apiHealthUrl = buildApiHealthUrl(
    process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:5000',
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">ArchitectAI Frontend</h1>
      <StatusCard title="API Connectivity">
        <p className="text-zinc-600 dark:text-zinc-300">
          Monorepo frontend scaffold is running. Backend health endpoint is expected at:
        </p>
        <a
          href={apiHealthUrl}
          target="_blank"
          className="rounded bg-zinc-100 p-1 text-sm dark:bg-zinc-900"
        >
          {apiHealthUrl}
        </a>
      </StatusCard>
    </main>
  );
}
