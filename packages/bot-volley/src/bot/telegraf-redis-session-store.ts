import type { RedisClientType } from 'redis';
import type { SessionStore } from 'telegraf';

/**
 * Хранилище сессий Telegraf в Redis без повторного connect().
 * Адаптер `@telegraf/session/redis` всегда вызывает client.connect(), что ломает уже открытый сокет общего клиента приложения.
 */
export function createConnectedRedisSessionStore<S extends Record<string, unknown>>(
  client: RedisClientType,
  prefix = 'tg:sess:',
): SessionStore<S> {
  return {
    async get(key: string): Promise<S | undefined> {
      const value = await client.get(prefix + key);
      return value ? (JSON.parse(value) as S) : undefined;
    },
    async set(key: string, session: S): Promise<unknown> {
      return client.set(prefix + key, JSON.stringify(session));
    },
    async delete(key: string): Promise<unknown> {
      return client.del(prefix + key);
    },
  };
}
