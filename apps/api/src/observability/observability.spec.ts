import { initSentry } from './sentry';
import { startTracing } from './tracing';

/**
 * Both integrations are env-gated so a production/dev run with no config is a
 * zero-overhead no-op. These tests pin that contract.
 */
describe('observability env-gating', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('startTracing is a no-op with no exporter configured', () => {
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    delete process.env.OTEL_TRACES_CONSOLE;
    // The console/OTLP path (returns true, starts a real SDK) is verified live
    // rather than in-process to avoid leaking a global tracer provider here.
    expect(startTracing('test')).toBe(false);
  });

  it('initSentry is a no-op without SENTRY_DSN', () => {
    delete process.env.SENTRY_DSN;
    expect(initSentry()).toBe(false);
  });
});
