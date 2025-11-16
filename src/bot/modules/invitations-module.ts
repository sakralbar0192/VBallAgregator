import { Telegraf, Context } from 'telegraf';
import { IBotModule } from './bot-module-registry.js';
import { InvitationHandler } from '../invitations/index.js';
import { CommandValidator } from '../common/index.js';

/**
 * Модуль управления приглашениями
 */
export class InvitationsModule implements IBotModule {
  name = 'InvitationsModule';

  async register(bot: Telegraf<Context>): Promise<void> {
    // Команда ответа на приглашение
    bot.command('respondtogame', async (ctx) => {
      const args = CommandValidator.validateMultiArgCommand(ctx);
      await InvitationHandler.handleRespondToGame(ctx, args);
    });

    // Обработчики callback'ов для приглашений
    bot.action(/^respond_game_(.+)_yes$/, async (ctx) => {
      await InvitationHandler.handleRespondGameYes(ctx, ctx.match[0]);
    });

    bot.action(/^respond_game_(.+)_no$/, async (ctx) => {
      await InvitationHandler.handleRespondGameNo(ctx, ctx.match[0]);
    });
  }
}
