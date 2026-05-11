import { describe, it, expect } from '@jest/globals';
import type { AppConfig } from '../shared/config.js';
import { validateConfig } from '../shared/config.js';

describe('validateConfig', () => {
  const base = (): AppConfig => ({
    database: {
      url: 'postgresql://x',
      maxConnections: 10,
      queryTimeout: 30000,
    },
    redis: {
      host: 'localhost',
      port: 6379,
      maxRetriesPerRequest: null,
    },
    telegram: {
      botToken: 'token',
    },
    localization: {
      defaultTimezone: 'UTC',
      supportedTimezones: ['UTC'],
    },
    notifications: {
      maxRetries: 3,
      backoffMultiplier: 2,
      batchSize: 50,
    },
    queues: {
      concurrency: 5,
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  });

  it('throws when DATABASE_URL missing', () => {
    const c = base();
    c.database.url = '';
    expect(() => validateConfig(c)).toThrow('DATABASE_URL');
  });

  it('throws when TELEGRAM_BOT_TOKEN missing', () => {
    const c = base();
    c.telegram.botToken = '';
    expect(() => validateConfig(c)).toThrow('TELEGRAM_BOT_TOKEN');
  });

  it('throws when NOTIFICATION_RETRIES out of range', () => {
    const c = base();
    c.notifications.maxRetries = 0;
    expect(() => validateConfig(c)).toThrow('NOTIFICATION_RETRIES');

    c.notifications.maxRetries = 11;
    expect(() => validateConfig(c)).toThrow('NOTIFICATION_RETRIES');
  });
});
