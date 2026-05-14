import type { PrismaClient, Prisma } from '@prisma/client';

/** Строка outbox (минимум полей для publisher / record). */
export type MessagingOutboxRow = {
  id: string;
  eventType: string;
  schemaVersion: number;
  aggregateId: string | null;
  correlationId: string | null;
  payload: unknown;
  occurredAt: Date;
  createdAt: Date;
  publishedAt: Date | null;
};

/**
 * Делегат `messagingOutbox` без прямого обращения `prisma.messagingOutbox` в типах PrismaClient:
 * так IDE не падает, если локальный `prisma generate` ещё не подтянул модель после смены схемы.
 * В рантайме проверяем наличие делегата.
 */
export type MessagingOutboxDelegate = {
  findMany(args: {
    where: { publishedAt: null };
    orderBy: { createdAt: 'asc' };
    take: number;
  }): Promise<MessagingOutboxRow[]>;
  update(args: {
    where: { id: string };
    data: { publishedAt: Date };
  }): Promise<MessagingOutboxRow>;
  create(args: {
    data: {
      eventType: string;
      schemaVersion: number;
      aggregateId: string | null;
      correlationId: string | null;
      payload: object;
      occurredAt: Date;
    };
  }): Promise<MessagingOutboxRow>;
};

const DELEGATE_KEY = 'messagingOutbox';

export function getMessagingOutboxDelegate(prismaClient: PrismaClient | Prisma.TransactionClient): MessagingOutboxDelegate {
  const raw = prismaClient as unknown as Record<string, MessagingOutboxDelegate | undefined>;
  const delegate = raw[DELEGATE_KEY];
  if (!delegate || typeof delegate.findMany !== 'function') {
    throw new Error(
      'Prisma Client has no messagingOutbox delegate. Run: npm run prisma:generate (and restart TS server if IDE still errors).'
    );
  }
  return delegate;
}
