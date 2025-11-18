import { createClient } from 'redis';
import { config } from './config.js';
import { LoggerFactory } from './layer-logger.js';
import { LOG_MESSAGES } from './logging-messages.js';

const logger = LoggerFactory.external('idempotency-service');

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
      logger.error('constructor', LOG_MESSAGES.INFRASTRUCTURE_SERVICES.IDEMPOTENCY_SERVICE_REDIS_ERROR, err, { error: err.message });
    });

    this.client.on('connect', () => {
      logger.info('constructor', LOG_MESSAGES.INFRASTRUCTURE_SERVICES.IDEMPOTENCY_SERVICE_REDIS_CONNECTED);
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
        logger.info('ensureNotSentRecently', 'Уведомление заблокировано проверкой идемпотентности', {
          userId,
          gameId,
          type,
          cooldownSeconds: cooldown
        });
        return false; // Block duplicate
      }

      logger.info('ensureNotSentRecently', 'Уведомление разрешено проверкой идемпотентности', {
        userId,
        gameId,
        type,
        cooldownSeconds: cooldown
      });

      return true; // Allow notification
    } catch (error) {
      logger.warn('ensureNotSentRecently', 'Проверка идемпотентности не удалась, разрешение уведомления', {
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