import { Logger } from '@nestjs/common';
import type { RequestLogContext } from '../logging/request-log-context';

type SentryModule = {
  init: (options: Record<string, unknown>) => void;
  withScope: (callback: (scope: SentryScope) => void) => void;
  captureException: (exception: unknown) => void;
};

type SentryScope = {
  setTag: (name: string, value: string) => void;
  setUser: (user: { id?: string | null }) => void;
  setContext: (name: string, context: Record<string, unknown>) => void;
};

const logger = new Logger('ErrorTracker');
let sentryModule: SentryModule | null | undefined;
let initialized = false;

export function initErrorTracker(): void {
  if (initialized) {
    return;
  }
  initialized = true;

  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) {
    return;
  }

  const sentry = loadSentryModule();
  if (!sentry) {
    logger.warn(
      'SENTRY_DSN is set but @sentry/node is not available; falling back to structured logs only.',
    );
    return;
  }

  sentry.init({
    dsn,
    environment:
      process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
  });
}

export function captureError(
  exception: unknown,
  context: RequestLogContext,
): void {
  const sentry = loadSentryModule();
  if (!sentry) {
    return;
  }

  sentry.withScope((scope) => {
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
    scope.setContext('request', {
      method: context.method,
      route: context.route,
    });
    sentry.captureException(exception);
  });
}

function loadSentryModule(): SentryModule | null {
  if (sentryModule !== undefined) {
    return sentryModule;
  }

  try {
    // Use runtime require so this remains optional when the package is absent.
    const runtimeRequire = require as (path: string) => SentryModule;
    sentryModule = runtimeRequire('@sentry/node');
  } catch {
    sentryModule = null;
  }
  return sentryModule;
}
