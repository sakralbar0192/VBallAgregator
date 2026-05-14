/**
 * Заготовка OpenTelemetry: при `OTEL_ENABLED=true` сюда подключается SDK.
 * Пока — no-op, чтобы единая точка инициализации уже была в `apps/server`.
 */
export function initTelemetry(): void {
  if (process.env.OTEL_ENABLED === 'true') {
    // Подключите @opentelemetry/sdk-node и экспортёр в отдельном PR.
    console.info('[telemetry] OTEL_ENABLED=true (SDK wiring pending)');
  }
}
