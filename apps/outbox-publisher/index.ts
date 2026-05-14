import 'dotenv/config';
import { prisma } from '../../packages/core/src/infrastructure/prisma.js';
import { getMessagingOutboxDelegate } from '../../packages/core/src/infrastructure/messaging-outbox-delegate.js';
import {
  openRabbitConnection,
  publishDomainEvent,
} from '../../packages/messaging-rabbit/src/connection.js';
import { domainEventEnvelopeSchema } from '../../packages/shared-kernel/src/index.js';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`${name} is required`);
  }
  return v;
}

async function main(): Promise<void> {
  const url = requireEnv('RABBITMQ_URL');
  const { connection, channel } = await openRabbitConnection(url);

  let running = true;

  const shutdown = async () => {
    running = false;
    await channel.close();
    await connection.close();
    await prisma.$disconnect();
  };
  process.on('SIGINT', () => void shutdown().then(() => process.exit(0)));
  process.on('SIGTERM', () => void shutdown().then(() => process.exit(0)));

  const pollMs = parseInt(process.env.OUTBOX_POLL_INTERVAL_MS || '2000', 10);

  const outbox = getMessagingOutboxDelegate(prisma);

  while (running) {
    const batch = await outbox.findMany({
      where: { publishedAt: null },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });

    for (const row of batch) {
      if (!running) break;
      const envelope = domainEventEnvelopeSchema.parse({
        eventType: row.eventType,
        schemaVersion: row.schemaVersion,
        aggregateId: row.aggregateId,
        correlationId: row.correlationId,
        occurredAt: row.occurredAt.toISOString(),
        payload: row.payload,
      });
      const body = Buffer.from(
        JSON.stringify(envelope, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))
      );
      const ok = publishDomainEvent(channel, envelope.eventType, body);
      if (!ok) {
        console.warn('[outbox-publisher] channel backpressure, retry later', row.id);
        break;
      }
      await outbox.update({
        where: { id: row.id },
        data: { publishedAt: new Date() },
      });
    }

    await new Promise(r => setTimeout(r, pollMs));
  }
}

main().catch(async err => {
  console.error('[outbox-publisher]', err);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
