import { createClient } from 'redis';
import { config } from './config.js';
import { logger } from './logger.js';

export interface RateLimiterService {
  checkQuota(key: string, limit: number, window: number): Promise<boolean>;
  consumeQuota(key: string, tokens: number): Promise<void>;
}

export class RedisRateLimiter implements RateLimiterService {
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
      logger.error('Redis connection error', { error: err.message });
    });

    this.client.on('connect', () => {
      logger.info('Connected to Redis for rate limiting');
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

  async checkQuota(key: string, limit: number, window: number): Promise<boolean> {
    try {
      await this.connect();

      const now = Date.now();
      const windowStart = now - window * 1000;

      // Remove old entries and count current ones
      const multi = this.client.multi();
      (multi as any).zremrangebyscore(key, 0, windowStart);
      (multi as any).zcard(key);

      const results = await multi.exec();
      const currentCount = (results?.[1] as any) || 0;

      return currentCount < limit;
    } catch (error) {
      logger.warn('Rate limiter check failed, allowing request', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // Fail-open: allow request if Redis is unavailable
      return true;
    }
  }

  async consumeQuota(key: string, tokens: number = 1): Promise<void> {
    try {
      await this.connect();

      const now = Date.now();
      const multi = this.client.multi();

      // Add tokens with current timestamp
      for (let i = 0; i < tokens; i++) {
        (multi as any).zadd(key, now, `${now}-${i}`);
      }

      await multi.exec();
    } catch (error) {
      logger.warn('Rate limiter consume failed, ignoring', {
        key,
        tokens,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // Fail-open: don't block if Redis fails
    }
  }

  // Telegram-specific rate limiter (30 messages/minute)
  async checkTelegramQuota(): Promise<boolean> {
    return this.checkQuota('telegram:global', 30, 60);
  }

  async consumeTelegramQuota(): Promise<void> {
    return this.consumeQuota('telegram:global', 1);
  }

  // Per-organizer rate limiter (10 messages/minute per organizer)
  async checkOrganizerQuota(organizerId: string): Promise<boolean> {
    return this.checkQuota(`telegram:organizer:${organizerId}`, 10, 60);
  }

  async consumeOrganizerQuota(organizerId: string): Promise<void> {
    return this.consumeQuota(`telegram:organizer:${organizerId}`, 1);
  }
}

// Singleton instance
export const rateLimiter = new RedisRateLimiter();