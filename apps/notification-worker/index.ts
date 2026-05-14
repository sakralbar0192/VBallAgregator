import 'dotenv/config';
import { connect } from 'amqplib';
import { DOMAIN_EVENTS_EXCHANGE } from '../../packages/messaging-rabbit/src/connection.js';

const QUEUE = process.env.NOTIFICATION_QUEUE_NAME || 'notification.worker';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`${name} is required`);
  }
  return v;
}

async function main(): Promise<void> {
  const url = requireEnv('RABBITMQ_URL');
  const connection = await connect(url);
  const channel = await connection.createChannel();
  await channel.assertExchange(DOMAIN_EVENTS_EXCHANGE, 'topic', { durable: true });
  await channel.assertQueue(QUEUE, { durable: true });
  await channel.bindQueue(QUEUE, DOMAIN_EVENTS_EXCHANGE, '#');

  await channel.consume(
    QUEUE,
    msg => {
      if (!msg) return;
      try {
        const body = JSON.parse(msg.content.toString()) as { eventType?: string; aggregateId?: string | null };
        console.log('[notification-worker]', body.eventType, body.aggregateId ?? '');
        channel.ack(msg);
      } catch {
        channel.nack(msg, false, false);
      }
    },
    { noAck: false }
  );

  console.log('[notification-worker] listening on', QUEUE);
}

main().catch(err => {
  console.error('[notification-worker]', err);
  process.exit(1);
});
