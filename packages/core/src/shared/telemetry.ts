/**
 * OpenTelemetry: при `OTEL_ENABLED=true` регистрируется OTLP trace exporter.
 * Эндпоинт по умолчанию: `http://localhost:4318/v1/traces` (или `OTEL_EXPORTER_OTLP_ENDPOINT`).
 */
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

let sdk: NodeSDK | undefined;

export function initTelemetry(): void {
  if (process.env.OTEL_ENABLED !== 'true') {
    return;
  }

  const traceExporter = new OTLPTraceExporter();
  sdk = new NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'vballagregator',
    traceExporter,
  });
  sdk.start();

  const shutdown = () => {
    void sdk?.shutdown().catch(() => undefined);
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}
