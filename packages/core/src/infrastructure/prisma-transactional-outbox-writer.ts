import type { Prisma } from '@prisma/client';
import type { DbTransaction, OutboxEventInput, TransactionalOutboxWriter } from '../../../contracts/src/index.js';
import { recordDomainEventToOutbox } from './messaging-outbox-record.js';
import { prisma } from './prisma.js';

export class PrismaTransactionalOutboxWriter implements TransactionalOutboxWriter {
  async appendInTransaction(tx: DbTransaction, event: OutboxEventInput): Promise<void> {
    await recordDomainEventToOutbox(
      { type: event.type, occurredAt: event.occurredAt, payload: event.payload },
      event.correlationId ?? null,
      tx as Prisma.TransactionClient | typeof prisma
    );
  }
}
