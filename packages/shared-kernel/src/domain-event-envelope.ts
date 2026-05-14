import { z } from 'zod';

/** Версия схемы envelope; увеличивать при несовместимых изменениях полей обёртки (не payload). */
export const DOMAIN_EVENT_ENVELOPE_SCHEMA_VERSION = 1 as const;

export const domainEventEnvelopeSchema = z.object({
  eventType: z.string().min(1),
  schemaVersion: z.number().int().positive(),
  aggregateId: z.string().nullable(),
  correlationId: z.string().nullable(),
  occurredAt: z.string(),
  payload: z.unknown(),
});

export type DomainEventEnvelope = z.infer<typeof domainEventEnvelopeSchema>;

export function buildEnvelope(input: {
  eventType: string;
  payload: unknown;
  occurredAt: Date;
  correlationId?: string | null;
  aggregateId?: string | null;
}): DomainEventEnvelope {
  return domainEventEnvelopeSchema.parse({
    eventType: input.eventType,
    schemaVersion: DOMAIN_EVENT_ENVELOPE_SCHEMA_VERSION,
    aggregateId: input.aggregateId ?? null,
    correlationId: input.correlationId ?? null,
    occurredAt: input.occurredAt.toISOString(),
    payload: input.payload,
  });
}

/** Извлечь aggregateId из типичных payload домена (эвристика для индексации outbox). */
export function inferAggregateIdFromPayload(eventType: string, payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.gameId === 'string') return p.gameId;
  if (typeof p.userId === 'string' && eventType.includes('User')) return p.userId as string;
  if (typeof p.playerId === 'string') return p.playerId as string;
  return null;
}
