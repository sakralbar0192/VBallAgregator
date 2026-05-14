import { prisma } from './prisma.js';
import { buildEnvelope, inferAggregateIdFromPayload } from '../../../shared-kernel/src/index.js';
import { getMessagingOutboxDelegate } from './messaging-outbox-delegate.js';

export type OutboxDomainEvent = {
  type: string;
  occurredAt: Date;
  payload: unknown;
};

function jsonSafePayload(payload: unknown): unknown {
  return JSON.parse(JSON.stringify(payload, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));
}

/**
 * Запись в transactional outbox (монолит). Включается `OUTBOX_RECORD_ENABLED=true`.
 * Полная транзакционность с бизнес-операцией — следующий шаг рефакторинга use cases.
 */
export async function recordDomainEventToOutbox(
  event: OutboxDomainEvent,
  correlationId?: string | null
): Promise<void> {
  const safePayload = jsonSafePayload(event.payload);
  const envelope = buildEnvelope({
    eventType: event.type,
    payload: safePayload,
    occurredAt: event.occurredAt,
    correlationId: correlationId ?? null,
    aggregateId: inferAggregateIdFromPayload(event.type, safePayload),
  });

  await getMessagingOutboxDelegate(prisma).create({
    data: {
      eventType: envelope.eventType,
      schemaVersion: envelope.schemaVersion,
      aggregateId: envelope.aggregateId,
      correlationId: envelope.correlationId,
      payload: envelope.payload as object,
      occurredAt: new Date(envelope.occurredAt),
    },
  });
}
