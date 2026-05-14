import { prisma } from '../infrastructure/prisma.js';
import { LoggerFactory } from './layer-logger.js';
import { LOG_MESSAGES } from './logging-messages.js';

const logger = LoggerFactory.external('user-preferences-service');

export interface NotificationPreferences {
  globalNotifications: boolean;
  paymentRemindersAuto: boolean;
  paymentRemindersManual: boolean;
  gameReminders24h: boolean;
  gameReminders2h: boolean;
  organizerNotifications: boolean;
}

export interface UserPreferencesService {
  getPreferences(userId: string): Promise<NotificationPreferences>;
  updatePreferences(userId: string, preferences: Partial<NotificationPreferences>): Promise<void>;
  isAllowed(userId: string, notificationType: string): Promise<boolean>;
}

export class PrismaUserPreferencesService implements UserPreferencesService {
  private preferencesCache = new Map<string, { data: NotificationPreferences; expiry: number }>();
  private CACHE_TTL = 5 * 60 * 1000; // 5 минут

  async getPreferences(userId: string): Promise<NotificationPreferences> {
    try {
      const cached = this.preferencesCache.get(userId);
      if (cached && cached.expiry > Date.now()) {
        return cached.data;
      }

      const prefs = await prisma.userNotificationPreferences.findUnique({
        where: { userId }
      });

      if (!prefs) {
        // Create default preferences
        const defaultPrefs = await prisma.userNotificationPreferences.create({
          data: { userId }
        });
        const mappedPrefs = this.mapToPreferences(defaultPrefs);
        this.preferencesCache.set(userId, {
          data: mappedPrefs,
          expiry: Date.now() + this.CACHE_TTL
        });
        return mappedPrefs;
      }

      const mappedPrefs = this.mapToPreferences(prefs);
      this.preferencesCache.set(userId, {
        data: mappedPrefs,
        expiry: Date.now() + this.CACHE_TTL
      });
      return mappedPrefs;
    } catch (error) {
      logger.error('isAllowed', LOG_MESSAGES.INFRASTRUCTURE_SERVICES.USER_PREFERENCES_SERVICE_GET_FAILED, error as Error, {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // Return defaults on error
      return this.getDefaultPreferences();
    }
  }

  async updatePreferences(userId: string, preferences: Partial<NotificationPreferences>): Promise<void> {
    try {
      await prisma.userNotificationPreferences.upsert({
        where: { userId },
        update: {
          ...preferences,
          updatedAt: new Date()
        },
        create: {
          userId,
          ...preferences
        }
      });

      logger.info('updatePreferences', LOG_MESSAGES.INFRASTRUCTURE_SERVICES.USER_PREFERENCES_SERVICE_UPDATE_COMPLETED, { userId, preferences });
    } catch (error) {
      logger.error('updatePreferences', LOG_MESSAGES.INFRASTRUCTURE_SERVICES.USER_PREFERENCES_SERVICE_UPDATE_FAILED, error as Error, {
        userId,
        preferences,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async isAllowed(userId: string, notificationType: string): Promise<boolean> {
    try {
      const prefs = await this.getPreferences(userId);

      // Check global notifications first
      if (!prefs.globalNotifications) {
        return false;
      }

      // Check specific notification type
      switch (notificationType) {
        case 'payment-reminder-12h':
        case 'payment-reminder-24h':
          return prefs.paymentRemindersAuto;

        case 'manual-payment-reminder':
          return prefs.paymentRemindersManual;

        case 'game-reminder-24h':
          return prefs.gameReminders24h;

        case 'game-reminder-2h':
          return prefs.gameReminders2h;

        case 'player-joined':
        case 'payment-marked':
        case 'waitlist-promoted':
          return prefs.organizerNotifications;

        default:
          logger.warn('isAllowed', LOG_MESSAGES.INFRASTRUCTURE_SERVICES.USER_PREFERENCES_SERVICE_UNKNOWN_TYPE, {
            userId,
            notificationType
          });
          return true; // Allow unknown types by default
      }
    } catch (error) {
      logger.warn('isAllowed', LOG_MESSAGES.INFRASTRUCTURE_SERVICES.USER_PREFERENCES_SERVICE_CHECK_FAILED, {
        userId,
        notificationType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // Fail-open: allow notification if preferences service fails
      return true;
    }
  }

  private mapToPreferences(dbPrefs: any): NotificationPreferences {
    return {
      globalNotifications: dbPrefs.globalNotifications,
      paymentRemindersAuto: dbPrefs.paymentRemindersAuto,
      paymentRemindersManual: dbPrefs.paymentRemindersManual,
      gameReminders24h: dbPrefs.gameReminders24h,
      gameReminders2h: dbPrefs.gameReminders2h,
      organizerNotifications: dbPrefs.organizerNotifications,
    };
  }

  private getDefaultPreferences(): NotificationPreferences {
    return {
      globalNotifications: true,
      paymentRemindersAuto: true,
      paymentRemindersManual: true,
      gameReminders24h: true,
      gameReminders2h: true,
      organizerNotifications: true,
    };
  }
}

// Singleton instance
export const userPreferencesService = new PrismaUserPreferencesService();