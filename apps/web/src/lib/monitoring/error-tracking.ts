type ErrorContext = {
  userId?: string | null;
  organizationId?: string | null;
  repositoryId?: string | null;
  requestId?: string | null;
};

let warnedMissingSentry = false;

export async function configureErrorTracking(): Promise<void> {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    return;
  }
  const sentry = await loadSentryModule();
  if (!sentry) {
    warnMissingSentry();
    return;
  }

  sentry.init({
    dsn,
    environment:
      process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0),
  });
}

export async function setErrorTrackingIdentity(context: ErrorContext): Promise<void> {
  const sentry = await loadSentryModule();
  if (!sentry) {
    return;
  }
  if (context.userId) {
    sentry.setUser({ id: context.userId });
  } else {
    sentry.setUser(null);
  }
  if (context.organizationId) {
    sentry.setTag('organizationId', context.organizationId);
  }
}

export async function captureClientError(error: Error, context: ErrorContext = {}): Promise<void> {
  const sentry = await loadSentryModule();
  if (!sentry) {
    warnMissingSentry();
    return;
  }

  sentry.withScope(
    (scope: {
      setTag: (name: string, value: string) => void;
      setUser: (user: { id: string } | null) => void;
    }) => {
      if (context.userId) {
        scope.setUser({ id: context.userId });
      }
      if (context.organizationId) {
        scope.setTag('organizationId', context.organizationId);
      }
      if (context.repositoryId) {
        scope.setTag('repositoryId', context.repositoryId);
      }
      if (context.requestId) {
        scope.setTag('requestId', context.requestId);
      }
      sentry.captureException(error);
    },
  );
}

async function loadSentryModule(): Promise<{
  init: (options: Record<string, unknown>) => void;
  captureException: (error: Error) => void;
  setUser: (user: { id: string } | null) => void;
  setTag: (name: string, value: string) => void;
  withScope: (
    callback: (scope: {
      setTag: (name: string, value: string) => void;
      setUser: (user: { id: string } | null) => void;
    }) => void,
  ) => void;
} | null> {
  try {
    const dynamicImport = Function('moduleName', 'return import(moduleName)') as (
      moduleName: string,
    ) => Promise<unknown>;
    return (await dynamicImport('@sentry/nextjs')) as {
      init: (options: Record<string, unknown>) => void;
      captureException: (error: Error) => void;
      setUser: (user: { id: string } | null) => void;
      setTag: (name: string, value: string) => void;
      withScope: (
        callback: (scope: {
          setTag: (name: string, value: string) => void;
          setUser: (user: { id: string } | null) => void;
        }) => void,
      ) => void;
    };
  } catch {
    return null;
  }
}

function warnMissingSentry(): void {
  if (warnedMissingSentry) {
    return;
  }
  warnedMissingSentry = true;
  // Keep this visible in browser/dev logs when DSN is configured but package setup is missing.
  console.warn(
    'Error tracking DSN is configured but @sentry/nextjs is unavailable in this environment.',
  );
}
