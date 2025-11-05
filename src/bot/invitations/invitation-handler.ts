import { Context } from 'telegraf';
import { BaseHandler } from '../common/base-handler.js';
import { LoggerFactory } from '../../shared/layer-logger.js';
import { CommandHandlers } from '../command-handlers.js';
import { CallbackDataParser } from '../common/callback-parser.js';
import { prisma } from '../../infrastructure/prisma.js';

/**
 * Обработчик приглашений к играм
 */
export class InvitationHandler extends BaseHandler {
  protected static override logger = LoggerFactory.bot('invitation-handler');

  /**
   * Обработчик команды /respondtogame <game_id> <yes/no>
   * Позволяет ответить на приглашение к игре
   */
  static async handleRespondToGame(ctx: Context, args: string): Promise<void> {
    await CommandHandlers.handleRespondToGame(ctx, args);
  }

  /**
   * Обработчик действия respond_game_*_yes
   * Ответ "Да" на приглашение к игре
   */
  static async handleRespondGameYes(ctx: Context, data: string): Promise<void> {
    const parsed = CallbackDataParser.parseRespondGame(data);
    if (!parsed) {
      await ctx.answerCbQuery('Неверный формат действия');
      return;
    }

    const { gameId, response } = parsed;
    const user = await this.requireUser(ctx);

    try {
      const { respondToGameInvitation } = await import('../../application/use-cases.js');
      await respondToGameInvitation(gameId, user.id, response);
      await ctx.answerCbQuery('✅ Ответ "Да" отправлен');
      await ctx.editMessageText('✅ Вы ответили "Да" на приглашение!');
    } catch (error) {
      this.logger.error('handleRespondGameYes', 'Failed to respond to game invitation',
        error as Error,
        { userId: user.id, gameId, response }
      );
      await ctx.answerCbQuery('Ошибка при отправке ответа');
    }
  }

  /**
   * Обработчик действия respond_game_*_no
   * Ответ "Нет" на приглашение к игре
   */
  static async handleRespondGameNo(ctx: Context, data: string): Promise<void> {
    const parsed = CallbackDataParser.parseRespondGame(data);
    if (!parsed) {
      await ctx.answerCbQuery('Неверный формат действия');
      return;
    }

    const { gameId, response } = parsed;
    const user = await this.requireUser(ctx);

    try {
      const { respondToGameInvitation } = await import('../../application/use-cases.js');
      await respondToGameInvitation(gameId, user.id, response);
      await ctx.answerCbQuery('❌ Ответ "Нет" отправлен');
      await ctx.editMessageText('❌ Вы ответили "Нет" на приглашение!');
    } catch (error) {
      this.logger.error('handleRespondGameNo', 'Failed to respond to game invitation',
        error as Error,
        { userId: user.id, gameId, response }
      );
      await ctx.answerCbQuery('Ошибка при отправке ответа');
    }
  }
}