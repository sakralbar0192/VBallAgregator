import 'dotenv/config';
import { initTelemetry } from '../../packages/core/src/shared/telemetry.js';
import { connect } from 'amqplib';
import {
  DOMAIN_EVENTS_EXCHANGE,
  assertConsumerQueueWithDlq,
} from '../../packages/messaging-rabbit/src/connection.js';
import { domainEventEnvelopeSchema } from '../../packages/shared-kernel/src/index.js';

const QUEUE = process.env.NOTIFICATION_QUEUE_NAME || 'notification.worker';
const DEFAULT_ROUTING_KEYS = [
  'PlayerJoined',
  'WaitlistedPromoted',
  'RegistrationCanceled',
  'PaymentMarked',
] as const;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`${name} is required`);
  }
  return v;
}

function parseRoutingKeys(): string[] {
  const raw = process.env.NOTIFICATION_EVENT_ROUTING_KEYS;
  if (!raw?.trim()) {
    return [...DEFAULT_ROUTING_KEYS];
  }
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

const idempotencySeen = new Map<string, number>();
const IDEMPOTENCY_TTL_MS = parseInt(process.env.NOTIFICATION_IDEMPOTENCY_TTL_MS || String(24 * 60 * 60 * 1000), 10);
const IDEMPOTENCY_MAX = parseInt(process.env.NOTIFICATION_IDEMPOTENCY_MAX_KEYS || '5000', 10);

function pruneIdempotency(now: number): void {
  for (const [k, t] of idempotencySeen) {
    if (now - t > IDEMPOTENCY_TTL_MS) {
      idempotencySeen.delete(k);
    }
  }
  while (idempotencySeen.size > IDEMPOTENCY_MAX) {
    const first = idempotencySeen.keys().next().value;
    if (first === undefined) break;
    idempotencySeen.delete(first);
  }
}

function isDuplicateDelivery(outboxId: string | undefined, now: number): boolean {
  if (!outboxId) return false;
  pruneIdempotency(now);
  if (idempotencySeen.has(outboxId)) {
    return true;
  }
  idempotencySeen.set(outboxId, now);
  return false;
}

type InternalUser = { userId: string; telegramId: string; name: string };

async function fetchUserById(baseUrl: string, token: string, userId: string): Promise<InternalUser | null> {
  const url = `${baseUrl.replace(/\/$/, '')}/internal/users/by-id/${encodeURIComponent(userId)}`;
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`internal_api ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as InternalUser;
}

async function sendTelegram(botToken: string, telegramId: string, text: string): Promise<void> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: telegramId,
      text,
      disable_web_page_preview: true,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`telegram ${res.status} ${JSON.stringify(body)}`);
  }
  const ok = (body as { ok?: boolean }).ok;
  if (!ok) {
    throw new Error(`telegram api error ${JSON.stringify(body)}`);
  }
}

function buildMessageText(eventType: string, payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  switch (eventType) {
    case 'PlayerJoined': {
      const gameId = p.gameId;
      const status = p.status;
      return `Вы записаны на игру ${String(gameId)} (статус: ${String(status)}).`;
    }
    case 'WaitlistedPromoted':
      return `Вы подтверждены на игру ${String(p.gameId)} (с waitlist).`;
    case 'RegistrationCanceled':
      return `Регистрация на игру ${String(p.gameId)} отменена.`;
    case 'PaymentMarked':
      return `Оплата по игре ${String(p.gameId)} отмечена.`;
    default:
      return null;
  }
}

function targetUserId(eventType: string, payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.userId === 'string') return p.userId;
  return null;
}

async function main(): Promise<void> {
  initTelemetry();
  const url = requireEnv('RABBITMQ_URL');
  const botToken = requireEnv('TELEGRAM_BOT_TOKEN');
  const internalBase = requireEnv('INTERNAL_API_BASE_URL');
  const internalToken = requireEnv('INTERNAL_API_TOKEN');

  const connection = await connect(url);
  const channel = await connection.createChannel();
  const routingKeys = parseRoutingKeys();
  const prefetch = parseInt(process.env.NOTIFICATION_PREFETCH || '20', 10);
  const maxLenRaw = process.env.NOTIFICATION_QUEUE_MAX_LENGTH;
  const maxLength = maxLenRaw ? parseInt(maxLenRaw, 10) : undefined;

  await assertConsumerQueueWithDlq(channel, {
    queueName: QUEUE,
    routingKeys,
    prefetch,
    maxLength: Number.isFinite(maxLength as number) ? maxLength : undefined,
  });

  await channel.consume(
    QUEUE,
    async msg => {
      if (!msg) return;
      const outboxId =
        msg.properties.headers && typeof msg.properties.headers === 'object'
          ? (msg.properties.headers as Record<string, unknown>)['x-outbox-id']
          : undefined;
      const outboxKey = typeof outboxId === 'string' ? outboxId : undefined;

      try {
        const raw = JSON.parse(msg.content.toString()) as unknown;
        const envelope = domainEventEnvelopeSchema.parse(raw);
        const now = Date.now();

        if (outboxKey && isDuplicateDelivery(outboxKey, now)) {
          channel.ack(msg);
          return;
        }

        const userId = targetUserId(envelope.eventType, envelope.payload);
        const text = buildMessageText(envelope.eventType, envelope.payload);

        if (userId && text) {
          const user = await fetchUserById(internalBase, internalToken, userId);
          if (user) {
            await sendTelegram(botToken, user.telegramId, text);
          }
        }

        channel.ack(msg);
      } catch (err) {
        if (msg.fields.redelivered) {
          console.error('[notification-worker] permanent failure, sending to DLQ', err);
          channel.nack(msg, false, false);
        } else {
          console.warn('[notification-worker] transient failure, requeue', err);
          channel.nack(msg, false, true);
        }
      }
    },
    { noAck: false }
  );

  console.log('[notification-worker] listening on', QUEUE, 'bindings', routingKeys.join(','));
}

main().catch(err => {
  console.error('[notification-worker]', err);
  process.exit(1);
});
