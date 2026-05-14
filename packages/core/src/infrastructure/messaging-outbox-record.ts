import { prisma } from './prisma.js';
import { buildEnvelope, inferAggregateIdFromPayload } from '../../../shared-kernel/src/index.js';
import { getMessagingOutboxDelegate } from './messaging-outbox-delegate.js';
import type { Prisma } from '@prisma/client';

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
 * При переданном `client` запись идёт в той же interactive-транзакции Prisma.
 */
export async function recordDomainEventToOutbox(
  event: OutboxDomainEvent,
  correlationId?: string | null,
  client: typeof prisma | Prisma.TransactionClient = prisma
): Promise<void> {
  if (process.env.OUTBOX_RECORD_ENABLED !== 'true') {
    return;
  }
  const safePayload = jsonSafePayload(event.payload);
  const envelope = buildEnvelope({
    eventType: event.type,
    payload: safePayload,
    occurredAt: event.occurredAt,
    correlationId: correlationId ?? null,
    aggregateId: inferAggregateIdFromPayload(event.type, safePayload),
  });

  await getMessagingOutboxDelegate(client).create({
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
