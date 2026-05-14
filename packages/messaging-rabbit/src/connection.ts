import type { Channel, ChannelModel, ConfirmChannel, Options } from 'amqplib';
import { connect } from 'amqplib';

export const DOMAIN_EVENTS_EXCHANGE = 'vball.domain';

/** Dead-letter exchange for failed notification (and similar) consumers. */
export const DOMAIN_EVENTS_DLX = 'vball.domain.dlx';

export async function openRabbitConnection(url: string): Promise<{ connection: ChannelModel; channel: Channel }> {
  const connection = await connect(url);
  const channel = await connection.createChannel();
  await channel.assertExchange(DOMAIN_EVENTS_EXCHANGE, 'topic', { durable: true });
  return { connection, channel };
}

/**
 * Publisher channel with broker confirms. Use for outbox-publisher: set `publishedAt` only after `waitForConfirms` resolves.
 */
export async function openRabbitPublisherConnection(
  url: string
): Promise<{ connection: ChannelModel; channel: ConfirmChannel }> {
  const connection = await connect(url);
  const channel = await connection.createConfirmChannel();
  await channel.assertExchange(DOMAIN_EVENTS_EXCHANGE, 'topic', { durable: true });
  return { connection, channel };
}

export async function publishDomainEvent(
  channel: Channel | ConfirmChannel,
  routingKey: string,
  body: Buffer,
  publishOptions?: Options.Publish
): Promise<boolean> {
  return channel.publish(DOMAIN_EVENTS_EXCHANGE, routingKey, body, {
    persistent: true,
    contentType: 'application/json',
    ...publishOptions,
  });
}

/**
 * Publish one message and wait for broker confirm. Throws on nack/close.
 * Returns false if publish buffer is full (caller should retry later).
 */
export async function publishDomainEventConfirmed(
  channel: ConfirmChannel,
  routingKey: string,
  body: Buffer,
  publishOptions?: Options.Publish
): Promise<boolean> {
  const ok = channel.publish(DOMAIN_EVENTS_EXCHANGE, routingKey, body, {
    persistent: true,
    contentType: 'application/json',
    ...publishOptions,
  });
  if (!ok) {
    return false;
  }
  await channel.waitForConfirms();
  return true;
}

export interface AssertConsumerQueueWithDlqOptions {
  queueName: string;
  /** Topic routing keys to bind (e.g. `PlayerJoined`). Empty = no bindings. */
  routingKeys: string[];
  prefetch?: number;
  /** Max queue length (optional). */
  maxLength?: number;
}

/**
 * Assert DLX + main queue with dead-letter routing to DL queue; bind main queue to domain exchange.
 */
export async function assertConsumerQueueWithDlq(
  channel: Channel,
  options: AssertConsumerQueueWithDlqOptions
): Promise<void> {
  const prefetch = options.prefetch ?? 20;
  await channel.assertExchange(DOMAIN_EVENTS_EXCHANGE, 'topic', { durable: true });
  await channel.assertExchange(DOMAIN_EVENTS_DLX, 'direct', { durable: true });

  const dlqName = `${options.queueName}.dlq`;
  await channel.assertQueue(dlqName, { durable: true });

  const queueArgs: Record<string, unknown> = {
    'x-dead-letter-exchange': DOMAIN_EVENTS_DLX,
    'x-dead-letter-routing-key': dlqName,
  };
  if (options.maxLength != null && options.maxLength > 0) {
    queueArgs['x-max-length'] = options.maxLength;
    queueArgs['x-overflow'] = 'reject-publish';
  }

  await channel.assertQueue(options.queueName, {
    durable: true,
    arguments: queueArgs,
  });

  await channel.bindQueue(dlqName, DOMAIN_EVENTS_DLX, dlqName);

  for (const key of options.routingKeys) {
    await channel.bindQueue(options.queueName, DOMAIN_EVENTS_EXCHANGE, key);
  }

  await channel.prefetch(prefetch);
}
