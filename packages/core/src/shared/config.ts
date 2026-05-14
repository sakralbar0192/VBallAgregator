export interface AppConfig {
  database: {
    url: string;
    maxConnections: number;
    queryTimeout: number;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
    maxRetriesPerRequest: number | null;
  };
  telegram: {
    botToken: string;
    webhookUrl?: string;
  };
  localization: {
    defaultTimezone: string;
    supportedTimezones: string[];
  };
  notifications: {
    maxRetries: number;
    backoffMultiplier: number;
    batchSize: number;
  };
  queues: {
    concurrency: number;
    removeOnComplete: number;
    removeOnFail: number;
  };
}

function loadConfig(): AppConfig {
  return {
    database: {
      url: process.env.DATABASE_URL!,
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10'),
      queryTimeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000'),
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: null,
    },
    telegram: {
      botToken: process.env.TELEGRAM_BOT_TOKEN!,
      webhookUrl: process.env.TELEGRAM_WEBHOOK_URL,
    },
    localization: {
      defaultTimezone: process.env.DEFAULT_TIMEZONE || 'Asia/Irkutsk',
      supportedTimezones: ['Asia/Irkutsk', 'Europe/Moscow', 'UTC'],
    },
    notifications: {
      maxRetries: parseInt(process.env.NOTIFICATION_RETRIES || '3'),
      backoffMultiplier: 2,
      batchSize: parseInt(process.env.NOTIFICATION_BATCH_SIZE || '50'),
    },
    queues: {
      concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '5'),
      removeOnComplete: parseInt(process.env.QUEUE_KEEP_COMPLETED || '100'),
      removeOnFail: parseInt(process.env.QUEUE_KEEP_FAILED || '50'),
    },
  };
}

export function validateConfig(config: AppConfig): void {
  if (!config.database.url) {
    throw new Error('DATABASE_URL is required');
  }
  if (!config.telegram.botToken) {
    throw new Error('TELEGRAM_BOT_TOKEN is required');
  }
  if (config.notifications.maxRetries < 1 || config.notifications.maxRetries > 10) {
    throw new Error('NOTIFICATION_RETRIES must be between 1 and 10');
  }
}

export const config = loadConfig();