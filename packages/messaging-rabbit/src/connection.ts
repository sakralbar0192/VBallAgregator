import type { Channel, ChannelModel } from 'amqplib';
import { connect } from 'amqplib';

export const DOMAIN_EVENTS_EXCHANGE = 'vball.domain';

export async function openRabbitConnection(url: string): Promise<{ connection: ChannelModel; channel: Channel }> {
  const connection = await connect(url);
  const channel = await connection.createChannel();
  await channel.assertExchange(DOMAIN_EVENTS_EXCHANGE, 'topic', { durable: true });
  return { connection, channel };
}

export async function publishDomainEvent(
  channel: Channel,
  routingKey: string,
  body: Buffer
): Promise<boolean> {
  return channel.publish(DOMAIN_EVENTS_EXCHANGE, routingKey, body, {
    persistent: true,
    contentType: 'application/json',
  });
}
