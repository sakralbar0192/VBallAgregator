import { Telegraf, Context } from 'telegraf';
import { IBotModule } from './bot-module-registry.js';
import { SettingsHandler, OrganizerSelectionHandler } from '../settings/index.js';
import { CommandHandlers } from '../command-handlers.js';

/**
 * Модуль настроек пользователя
 */
export class SettingsModule implements IBotModule {
  name = 'SettingsModule';

  async register(bot: Telegraf<Context>): Promise<void> {
    // Команды настроек
    bot.command('selectorganizers', SettingsHandler.handleSelectOrganizers);
    bot.command('settings', CommandHandlers.handleSettings);

    // Обработчики callback'ов для настроек
    bot.action('toggle_global', SettingsHandler.handleToggleGlobal);
    bot.action('settings_payments', SettingsHandler.handleSettingsPayments);
    bot.action('settings_games', SettingsHandler.handleSettingsGames);
    bot.action('settings_organizer', SettingsHandler.handleSettingsOrganizer);
    bot.action('settings_select_organizers', CommandHandlers.handleSelectOrganizersSettings);
    bot.action('back_to_settings', SettingsHandler.handleBackToSettings);
    bot.action('toggle_payment_auto', SettingsHandler.handleTogglePaymentAuto);
    bot.action('toggle_payment_manual', SettingsHandler.handleTogglePaymentManual);
    bot.action('toggle_game_24h', SettingsHandler.handleToggleGame24h);
    bot.action('toggle_game_2h', SettingsHandler.handleToggleGame2h);
    bot.action('toggle_organizer_notifications', SettingsHandler.handleToggleOrganizerNotifications);

    // Выбор организаторов
    bot.action(/^toggle_organizer_(.+)$/, async (ctx) => {
      await OrganizerSelectionHandler.handleToggleOrganizer(ctx, ctx.match[0]);
    });
    bot.action('organizers_done', OrganizerSelectionHandler.handleOrganizersDone);
  }
}
