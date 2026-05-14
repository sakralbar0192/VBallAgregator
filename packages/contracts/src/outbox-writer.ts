import type { DbTransaction } from './query-context.js';

export type OutboxEventInput = {
  type: string;
  occurredAt: Date;
  payload: unknown;
  correlationId?: string | null;
};

/**
 * Append a row to the transactional outbox inside an existing DB transaction.
 */
export interface TransactionalOutboxWriter {
  appendInTransaction(tx: DbTransaction, event: OutboxEventInput): Promise<void>;
}
