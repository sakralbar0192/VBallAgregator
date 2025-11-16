import { createClient } from 'redis';
import { config } from './config.js';
import { logger } from './logger.js';

export interface IdempotencyService {
  ensureNotSentRecently(userId: string, gameId: string, type: string, cooldown: number): Promise<boolean>;
}

class RedisIdempotencyService implements IdempotencyService {
  private client: ReturnType<typeof createClient>;

  constructor() {
    this.client = createClient({
      socket: {
        host: config.redis.host,
        port: config.redis.port,
        connectTimeout: 5000,
      },
      password: config.redis.password,
    });

    this.client.on('error', (err) => {
      logger.error('Redis connection error in idempotency service', { error: err.message });
    });

    this.client.on('connect', () => {
      logger.info('Connected to Redis for idempotency');
    });
  }

  async connect(): Promise<void> {
    if (!this.client.isOpen) {
      await this.client.connect();
    }
  }

  async disconnect(): Promise<void> {
    if (this.client.isOpen) {
      await this.client.disconnect();
    }
  }

  async ensureNotSentRecently(userId: string, gameId: string, type: string, cooldown: number): Promise<boolean> {
    try {
      await this.connect();

      const key = `notification:${userId}:${gameId}:${type}`;
      const now = Date.now();
      const cooldownMs = cooldown * 1000;

      // Lua script for atomic check and set
      const script = `
        local key = KEYS[1]
        local cooldown = tonumber(ARGV[1])
        local now = tonumber(ARGV[2])

        local lastSent = redis.call('GET', key)
        if lastSent and (now - tonumber(lastSent)) < cooldown then
          return 0
        end

        redis.call('SETEX', key, cooldown, now)
        return 1
      `;

      const result = await (this.client as any).eval(script, {
        keys: [key],
        arguments: [cooldownMs.toString(), now.toString()]
      });

      if (result === 0) {
        logger.info('Notification blocked by idempotency', {
          userId,
          gameId,
          type,
          cooldownSeconds: cooldown
        });
        return false; // Block duplicate
      }

      logger.info('Notification allowed by idempotency check', {
        userId,
        gameId,
        type,
        cooldownSeconds: cooldown
      });

      return true; // Allow notification
    } catch (error) {
      logger.warn('Idempotency check failed, allowing notification', {
        userId,
        gameId,
        type,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // Fail-open: allow notification if Redis fails
      return true;
    }
  }
}

// Singleton instance
export const idempotencyService = new RedisIdempotencyService();