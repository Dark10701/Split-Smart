import * as Sentry from '@sentry/node';

/**
 * Sentry error tracking (M6-09). Env-gated on `SENTRY_DSN`: without it, init is
 * a no-op and `captureError` does nothing, so local/dev runs carry no overhead
 * and nothing is sent anywhere.
 */
let enabled = false;

export function initSentry(): boolean {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return false;
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0, // tracing is handled by OpenTelemetry
  });
  enabled = true;
  return true;
}

/** Report an unhandled error to Sentry when enabled; no-op otherwise. */
export function captureError(error: unknown): void {
  if (enabled) Sentry.captureException(error);
}
