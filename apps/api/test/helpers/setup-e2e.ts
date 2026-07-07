import { resolveTestDatabaseUrl } from './e2e-app';

// Runs before each e2e test module is loaded (jest `setupFiles`). Resolving the
// test database URL here ensures `TEST_DATABASE_URL` is promoted to
// `DATABASE_URL` before the spec files read it to decide whether to run.
resolveTestDatabaseUrl();
