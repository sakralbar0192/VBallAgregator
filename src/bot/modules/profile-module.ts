import { Telegraf, Context } from 'telegraf';
import { IBotModule } from './bot-module-registry.js';
import { ProfileHandler, PlayerManagementHandler } from '../profile/index.js';

/**
 * Модуль профиля и управления игроками
 */
export class ProfileModule implements IBotModule {
  name = 'ProfileModule';

  async register(bot: Telegraf<Context>): Promise<void> {
    // Команды профиля
    bot.command('my', ProfileHandler.handleMy);
    bot.command('myorganizers', ProfileHandler.handleMyOrganizers);
    bot.command('myplayers', PlayerManagementHandler.handleMyPlayers);
    bot.command('pendingplayers', PlayerManagementHandler.handlePendingPlayers);

    // Обработчики callback'ов для управления игроками
    bot.action(/^confirm_player_(.+)$/, async (ctx) => {
      await PlayerManagementHandler.handleConfirmPlayer(ctx, ctx.match[0]);
    });

    bot.action(/^reject_player_(.+)$/, async (ctx) => {
      await PlayerManagementHandler.handleRejectPlayer(ctx, ctx.match[0]);
    });
  }
}
