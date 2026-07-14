/**
 * OpenTelemetry tracing bootstrap (M6-05).
 *
 * MUST be imported before any instrumented library (http, express, pg) so the
 * auto-instrumentations can patch them. It is therefore the very first import
 * in `main.ts`.
 *
 * Env-gated so it is a zero-overhead no-op unless explicitly enabled:
 *   - `OTEL_EXPORTER_OTLP_ENDPOINT` set → export spans to that OTLP collector.
 *   - `OTEL_TRACES_CONSOLE=1`           → print spans to stdout (local verification).
 *   - neither                           → tracing disabled entirely.
 */
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ConsoleSpanExporter, type SpanExporter } from '@opentelemetry/sdk-trace-base';
import { Resource } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

let sdk: NodeSDK | undefined;

function chooseExporter(): SpanExporter | undefined {
  if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) return new OTLPTraceExporter();
  if (process.env.OTEL_TRACES_CONSOLE === '1') return new ConsoleSpanExporter();
  return undefined;
}

/** Start tracing if configured. Returns true when the SDK was started. */
export function startTracing(serviceName = 'splitsmart-api'): boolean {
  const exporter = chooseExporter();
  if (!exporter) return false;

  sdk = new NodeSDK({
    resource: new Resource({ [SEMRESATTRS_SERVICE_NAME]: serviceName }),
    traceExporter: exporter,
    // Skip fs instrumentation — it's noisy and low-value for an HTTP service.
    instrumentations: [
      getNodeAutoInstrumentations({ '@opentelemetry/instrumentation-fs': { enabled: false } }),
    ],
  });
  sdk.start();
  return true;
}

/** Flush and shut the tracer down cleanly on process exit. */
export async function stopTracing(): Promise<void> {
  await sdk?.shutdown();
}

// Auto-start on import so this works as a preload. Safe no-op when unconfigured.
const started = startTracing();
if (started) {
  console.log('[tracing] OpenTelemetry started');
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.once(signal, () => {
      void stopTracing();
    });
  }
}
