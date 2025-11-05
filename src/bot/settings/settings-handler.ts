import { Context } from 'telegraf';
import { BaseHandler } from '../common/base-handler.js';
import { LoggerFactory } from '../../shared/layer-logger.js';
import { CommandHandlers } from '../command-handlers.js';
import { KeyboardBuilder } from '../common/keyboard-builder.js';
import { prisma } from '../../infrastructure/prisma.js';

/**
 * Обработчик настроек пользователя
 */
export class SettingsHandler extends BaseHandler {
  protected static override logger = LoggerFactory.bot('settings-handler');

  /**
   * Обработчик команды /selectorganizers
   * Показывает список организаторов для выбора
   */
  static async handleSelectOrganizers(ctx: Context): Promise<void> {
    await CommandHandlers.handleSelectOrganizersSettings(ctx);
  }

  /**
   * Показывает главное меню настроек
   */
  static async handleSettings(ctx: Context): Promise<void> {
    await CommandHandlers.handleSettings(ctx);
  }

  /**
   * Обработчик действия settings_payments
   * Показывает настройки уведомлений об оплате
   */
  static async handleSettingsPayments(ctx: Context): Promise<void> {
    const user = await this.requireUser(ctx);

    try {
      const { userPreferencesService } = await import('../../shared/user-preferences-service.js');
      const prefs = await userPreferencesService.getPreferences(user.id);

      const settingsText = `
💰 Настройки уведомлений об оплате:

🤖 Автоматические напоминания: ${prefs.paymentRemindersAuto ? '✅ Включены' : '❌ Отключены'}
📢 Ручные напоминания: ${prefs.paymentRemindersManual ? '✅ Включены' : '❌ Отключены'}
      `.trim();

      const buttons = [
        [
          {
            text: prefs.paymentRemindersAuto ? '❌ Отключить авто' : '✅ Включить авто',
            callback_data: 'toggle_payment_auto'
          }
        ],
        [
          {
            text: prefs.paymentRemindersManual ? '❌ Отключить ручные' : '✅ Включить ручные',
            callback_data: 'toggle_payment_manual'
          }
        ],
        [
          { text: '⬅️ Назад', callback_data: 'back_to_settings' }
        ]
      ];

      await ctx.editMessageText(settingsText, {
        reply_markup: { inline_keyboard: buttons }
      });
    } catch (error) {
      this.logger.error('handleSettingsPayments', 'Failed to load payment settings',
        error as Error,
        { userId: user.id }
      );
      await ctx.answerCbQuery('Ошибка при загрузке настроек');
    }
  }

  /**
   * Обработчик действия settings_games
   * Показывает настройки уведомлений об играх
   */
  static async handleSettingsGames(ctx: Context): Promise<void> {
    const user = await this.requireUser(ctx);

    try {
      const { userPreferencesService } = await import('../../shared/user-preferences-service.js');
      const prefs = await userPreferencesService.getPreferences(user.id);

      const settingsText = `
🎾 Настройки уведомлений об играх:

⏰ Напоминания за 24 часа: ${prefs.gameReminders24h ? '✅ Включены' : '❌ Отключены'}
🚨 Напоминания за 2 часа: ${prefs.gameReminders2h ? '✅ Включены' : '❌ Отключены'}
      `.trim();

      const buttons = [
        [
          {
            text: prefs.gameReminders24h ? '❌ Отключить 24ч' : '✅ Включить 24ч',
            callback_data: 'toggle_game_24h'
          }
        ],
        [
          {
            text: prefs.gameReminders2h ? '❌ Отключить 2ч' : '✅ Включить 2ч',
            callback_data: 'toggle_game_2h'
          }
        ],
        [
          { text: '⬅️ Назад', callback_data: 'back_to_settings' }
        ]
      ];

      await ctx.editMessageText(settingsText, {
        reply_markup: { inline_keyboard: buttons }
      });
    } catch (error) {
      this.logger.error('handleSettingsGames', 'Failed to load game settings',
        error as Error,
        { userId: user.id }
      );
      await ctx.answerCbQuery('Ошибка при загрузке настроек');
    }
  }

  /**
   * Обработчик действия settings_organizer
   * Показывает настройки уведомлений организатора
   */
  static async handleSettingsOrganizer(ctx: Context): Promise<void> {
    const user = await this.requireUser(ctx);

    try {
      const { userPreferencesService } = await import('../../shared/user-preferences-service.js');
      const prefs = await userPreferencesService.getPreferences(user.id);

      const settingsText = `
👥 Настройки уведомлений организатора:

📬 Уведомления организатора: ${prefs.organizerNotifications ? '✅ Включены' : '❌ Отключены'}
      `.trim();

      const buttons = [
        [
          {
            text: prefs.organizerNotifications ? '❌ Отключить' : '✅ Включить',
            callback_data: 'toggle_organizer_notifications'
          }
        ],
        [
          { text: '⬅️ Назад', callback_data: 'back_to_settings' }
        ]
      ];

      await ctx.editMessageText(settingsText, {
        reply_markup: { inline_keyboard: buttons }
      });
    } catch (error) {
      this.logger.error('handleSettingsOrganizer', 'Failed to load organizer settings',
        error as Error,
        { userId: user.id }
      );
      await ctx.answerCbQuery('Ошибка при загрузке настроек');
    }
  }

  /**
   * Обработчик действия back_to_settings
   * Возвращает в главное меню настроек
   */
  static async handleBackToSettings(ctx: Context): Promise<void> {
    await this.handleSettings(ctx);
  }

  /**
   * Обработчики переключения настроек
   */
  static async handleToggleGlobal(ctx: Context): Promise<void> {
    const user = await this.requireUser(ctx);

    try {
      const { userPreferencesService } = await import('../../shared/user-preferences-service.js');
      const prefs = await userPreferencesService.getPreferences(user.id);
      await userPreferencesService.updatePreferences(user.id, {
        ...prefs,
        globalNotifications: !prefs.globalNotifications
      });

      await ctx.answerCbQuery('✅ Настройки обновлены');
      await this.handleSettings(ctx);
    } catch (error) {
      this.logger.error('handleToggleGlobal', 'Failed to toggle global notifications',
        error as Error,
        { userId: user.id }
      );
      await ctx.answerCbQuery('Ошибка при обновлении настроек');
    }
  }

  static async handleTogglePaymentAuto(ctx: Context): Promise<void> {
    const user = await this.requireUser(ctx);

    try {
      const { userPreferencesService } = await import('../../shared/user-preferences-service.js');
      const prefs = await userPreferencesService.getPreferences(user.id);
      await userPreferencesService.updatePreferences(user.id, {
        ...prefs,
        paymentRemindersAuto: !prefs.paymentRemindersAuto
      });
      await ctx.answerCbQuery('✅ Настройка обновлена');
      await ctx.editMessageText('💰 Настройки уведомлений об оплате обновлены');
    } catch (error) {
      this.logger.error('handleTogglePaymentAuto', 'Failed to toggle payment auto reminders',
        error as Error,
        { userId: user.id }
      );
      await ctx.answerCbQuery('Ошибка');
    }
  }

  static async handleTogglePaymentManual(ctx: Context): Promise<void> {
    const user = await this.requireUser(ctx);

    try {
      const { userPreferencesService } = await import('../../shared/user-preferences-service.js');
      const prefs = await userPreferencesService.getPreferences(user.id);
      await userPreferencesService.updatePreferences(user.id, {
        ...prefs,
        paymentRemindersManual: !prefs.paymentRemindersManual
      });
      await ctx.answerCbQuery('✅ Настройка обновлена');
      await ctx.editMessageText('💰 Настройки уведомлений об оплате обновлены');
    } catch (error) {
      this.logger.error('handleTogglePaymentManual', 'Failed to toggle payment manual reminders',
        error as Error,
        { userId: user.id }
      );
      await ctx.answerCbQuery('Ошибка');
    }
  }

  static async handleToggleGame24h(ctx: Context): Promise<void> {
    const user = await this.requireUser(ctx);

    try {
      const { userPreferencesService } = await import('../../shared/user-preferences-service.js');
      const prefs = await userPreferencesService.getPreferences(user.id);
      await userPreferencesService.updatePreferences(user.id, {
        ...prefs,
        gameReminders24h: !prefs.gameReminders24h
      });
      await ctx.answerCbQuery('✅ Настройка обновлена');
      await ctx.editMessageText('🎾 Настройки уведомлений об играх обновлены');
    } catch (error) {
      this.logger.error('handleToggleGame24h', 'Failed to toggle game 24h reminders',
        error as Error,
        { userId: user.id }
      );
      await ctx.answerCbQuery('Ошибка');
    }
  }

  static async handleToggleGame2h(ctx: Context): Promise<void> {
    const user = await this.requireUser(ctx);

    try {
      const { userPreferencesService } = await import('../../shared/user-preferences-service.js');
      const prefs = await userPreferencesService.getPreferences(user.id);
      await userPreferencesService.updatePreferences(user.id, {
        ...prefs,
        gameReminders2h: !prefs.gameReminders2h
      });
      await ctx.answerCbQuery('✅ Настройка обновлена');
      await ctx.editMessageText('🎾 Настройки уведомлений об играх обновлены');
    } catch (error) {
      this.logger.error('handleToggleGame2h', 'Failed to toggle game 2h reminders',
        error as Error,
        { userId: user.id }
      );
      await ctx.answerCbQuery('Ошибка');
    }
  }

  static async handleToggleOrganizerNotifications(ctx: Context): Promise<void> {
    const user = await this.requireUser(ctx);

    try {
      const { userPreferencesService } = await import('../../shared/user-preferences-service.js');
      const prefs = await userPreferencesService.getPreferences(user.id);
      await userPreferencesService.updatePreferences(user.id, {
        ...prefs,
        organizerNotifications: !prefs.organizerNotifications
      });
      await ctx.answerCbQuery('✅ Настройка обновлена');
      await ctx.editMessageText('👥 Настройки уведомлений организатора обновлены');
    } catch (error) {
      this.logger.error('handleToggleOrganizerNotifications', 'Failed to toggle organizer notifications',
        error as Error,
        { userId: user.id }
      );
      await ctx.answerCbQuery('Ошибка');
    }
  }
}