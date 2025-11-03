import { Telegraf } from 'telegraf';
import { config } from './config.js';
import { logger } from './logger.js';

export interface NotificationBatch {
  userId: string;
  chatId: bigint;
  message: string;
  type: string;
}

export interface BatchResult {
  successful: number;
  failed: number;
  errors: Array<{ userId: string; error: string }>;
}

export class NotificationService {
  private bot: Telegraf;
  private metrics = new NotificationTracker();

  constructor(botToken: string) {
    this.bot = new Telegraf(botToken);
  }

  async sendBatch(notifications: NotificationBatch[]): Promise<BatchResult> {
    const chunks = this.chunkArray(notifications, config.notifications.batchSize);
    const results: BatchResult[] = [];

    for (const chunk of chunks) {
      const chunkResult = await this.processBatch(chunk);
      results.push(chunkResult);

      // Rate limiting - пауза между батчами
      if (chunks.indexOf(chunk) < chunks.length - 1) {
        await this.delay(100); // 100ms между батчами
      }
    }

    return this.aggregateResults(results);
  }

  private async processBatch(batch: NotificationBatch[]): Promise<BatchResult> {
    const results = await Promise.allSettled(
      batch.map(notification => this.sendMessage(
        notification.chatId,
        notification.message,
        notification.type
      ))
    );

    const result: BatchResult = {
      successful: 0,
      failed: 0,
      errors: [],
    };

    results.forEach((res, index) => {
      if (res.status === 'fulfilled') {
        result.successful++;
      } else {
        result.failed++;
        result.errors.push({
          userId: batch[index]!.userId,
          error: res.reason.message || 'Unknown error',
        });
      }
    });

    return result;
  }

  async sendMessage(chatId: bigint | number, text: string, type: string = 'unknown'): Promise<void> {
    const maxRetries = config.notifications.maxRetries;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await this.bot.telegram.sendMessage(Number(chatId), text);

        // Метрики
        if (attempt === 0) {
          this.metrics.recordSent(type);
          this.metrics.recordDelivered(type);
        } else {
          this.metrics.recordRetry(type);
        }

        logger.info('Notification sent', {
          chatId,
          type,
          attempt: attempt + 1,
          textLength: text.length
        });
        return;

      } catch (error: any) {
        this.metrics.recordFailed(type);

        // Анализ типа ошибки
        if (this.isPermanentError(error)) {
          logger.error('Permanent notification error', {
            chatId,
            type,
            error: error.message
          });
          throw error; // Не ретраим permanent ошибки
        }

        logger.warn('Temporary notification error', {
          chatId,
          type,
          attempt: attempt + 1,
          error: error.message
        });

        if (attempt === maxRetries) {
          throw error;
        }

        // Exponential backoff с jitter
        const baseDelay = Math.pow(config.notifications.backoffMultiplier, attempt) * 1000;
        const jitter = Math.random() * 500; // До 500ms случайной задержки
        await this.delay(baseDelay + jitter);
      }
    }
  }

  private isPermanentError(error: any): boolean {
    const permanentErrorCodes = [
      'ETELEGRAM_BLOCKED_BY_USER',
      'ETELEGRAM_USER_DEACTIVATED',
      'ETELEGRAM_CHAT_NOT_FOUND',
    ];

    return permanentErrorCodes.some(code =>
      error.code === code || error.message?.includes(code)
    );
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private aggregateResults(results: BatchResult[]): BatchResult {
    return results.reduce(
      (acc, result) => ({
        successful: acc.successful + result.successful,
        failed: acc.failed + result.failed,
        errors: [...acc.errors, ...result.errors],
      }),
      { successful: 0, failed: 0, errors: [] }
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getMetrics() {
    return this.metrics.getAllMetrics();
  }
}

// Простая метрика для уведомлений
class NotificationTracker {
  private metrics = new Map<string, { sent: number; delivered: number; failed: number; retries: number }>();

  recordSent(type: string): void {
    this.getOrCreate(type).sent++;
  }

  recordDelivered(type: string): void {
    this.getOrCreate(type).delivered++;
    // Update global metrics
    import('./metrics.js').then(({ metrics }) => {
      metrics.notificationsSent.increment();
    });
  }

  recordFailed(type: string): void {
    this.getOrCreate(type).failed++;
  }

  recordRetry(type: string): void {
    this.getOrCreate(type).retries++;
  }

  getAllMetrics() {
    return Object.fromEntries(this.metrics);
  }

  private getOrCreate(type: string) {
    if (!this.metrics.has(type)) {
      this.metrics.set(type, { sent: 0, delivered: 0, failed: 0, retries: 0 });
    }
    return this.metrics.get(type)!;
  }
}