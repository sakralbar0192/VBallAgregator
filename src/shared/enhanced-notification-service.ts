import { Telegraf } from 'telegraf';
import { config } from './config.js';
import { logger } from './logger.js';
import { rateLimiter } from './rate-limiter.js';
import { idempotencyService } from './idempotency-service.js';
import { userPreferencesService } from './user-preferences-service.js';
import { NotificationTracker } from './notification-service.js';

export interface NotificationRequest {
  userId: string;
  chatId: bigint;
  message: string;
  type: string;
  gameId?: string;
}

export interface NotificationResult {
  sent: boolean;
  reason?: string;
}

export class EnhancedNotificationService {
  private bot: Telegraf;
  private metrics = new NotificationTracker();

  constructor(botToken: string) {
    this.bot = new Telegraf(botToken);
  }

  async sendNotification(req: NotificationRequest): Promise<NotificationResult> {
    const { userId, chatId, message, type, gameId } = req;

    try {
      // 1. Check user preferences
      const isAllowed = await userPreferencesService.isAllowed(userId, type);
      if (!isAllowed) {
        logger.info('Notification blocked by user preferences', { userId, type });
        return { sent: false, reason: 'user_preferences' };
      }

      // 2. Check idempotency (prevent duplicates)
      if (gameId) {
        const canSend = await idempotencyService.ensureNotSentRecently(
          userId,
          gameId,
          type,
          this.getCooldownForType(type)
        );
        if (!canSend) {
          logger.info('Notification blocked by idempotency', { userId, gameId, type });
          return { sent: false, reason: 'idempotency' };
        }
      }

      // 3. Check rate limit
      const canSendRate = await rateLimiter.checkTelegramQuota();
      if (!canSendRate) {
        logger.warn('Notification blocked by rate limit', { userId, type });
        return { sent: false, reason: 'rate_limit' };
      }

      // 4. Send the notification
      await this.sendMessage(chatId, message, type);

      // 5. Consume rate limit quota
      await rateLimiter.consumeTelegramQuota();

      logger.info('Notification sent successfully', { userId, type, gameId });
      return { sent: true };

    } catch (error) {
      logger.error('Failed to send notification', {
        userId,
        type,
        gameId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return { sent: false, reason: 'error' };
    }
  }

  async sendBatch(notifications: NotificationRequest[]): Promise<{ successful: number; failed: number; errors: Array<{ userId: string; reason: string }> }> {
    const results = await Promise.allSettled(
      notifications.map(notification => this.sendNotification(notification))
    );

    const result = {
      successful: 0,
      failed: 0,
      errors: [] as Array<{ userId: string; reason: string }>
    };

    results.forEach((res, index) => {
      const notification = notifications[index]!;
      if (res.status === 'fulfilled') {
        if (res.value.sent) {
          result.successful++;
        } else {
          result.failed++;
          result.errors.push({
            userId: notification.userId,
            reason: res.value.reason || 'unknown'
          });
  
          // Record blocked notifications in metrics
          import('./notification-metrics.js').then(({ NotificationTracker }) => {
            NotificationTracker.recordBlocked(notification.type, res.value.reason || 'unknown');
          });
        }
      } else {
        result.failed++;
        result.errors.push({
          userId: notification.userId,
          reason: 'error'
        });
      }
    });

    logger.info('Batch notification results', {
      total: notifications.length,
      successful: result.successful,
      failed: result.failed
    });

    return result;
  }

  async sendMessage(chatId: bigint | number, text: string, type: string = 'unknown'): Promise<void> {
    const maxRetries = config.notifications.maxRetries;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await this.bot.telegram.sendMessage(Number(chatId), text);

        // Metrics
        if (attempt === 0) {
          this.metrics.recordSent(type);
          this.metrics.recordDelivered(type);
        } else {
          this.metrics.recordRetry(type);
        }

        // Update global metrics
        import('./metrics.js').then(({ metrics }) => {
          metrics.notificationsSent.increment();
        });

        logger.info('Message sent', {
          chatId,
          type,
          attempt: attempt + 1,
          textLength: text.length
        });
        return;

      } catch (error: any) {
        this.metrics.recordFailed(type);

        // Analyze error type
        if (this.isPermanentError(error)) {
          logger.error('Permanent notification error', {
            chatId,
            type,
            error: error.message
          });
          throw error; // Don't retry permanent errors
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

        // Exponential backoff with jitter
        const baseDelay = Math.pow(config.notifications.backoffMultiplier, attempt) * 1000;
        const jitter = Math.random() * 500; // Up to 500ms random delay
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

  private getCooldownForType(type: string): number {
    switch (type) {
      case 'payment-reminder-12h':
      case 'payment-reminder-24h':
        return 3600; // 1 hour
      case 'game-reminder-24h':
      case 'game-reminder-2h':
        return 1800; // 30 minutes
      default:
        return 1800; // 30 minutes default
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getMetrics() {
    return this.metrics.getAllMetrics();
  }
}