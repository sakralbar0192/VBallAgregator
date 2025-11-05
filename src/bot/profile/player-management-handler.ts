import { Context } from 'telegraf';
import { BaseHandler } from '../common/base-handler.js';
import { LoggerFactory } from '../../shared/layer-logger.js';
import { CommandHandlers } from '../command-handlers.js';
import { CallbackDataParser } from '../common/callback-parser.js';

/**
 * Обработчик управления игроками (для организаторов)
 */
export class PlayerManagementHandler extends BaseHandler {
  protected static override logger = LoggerFactory.bot('player-management-handler');

  /**
   * Обработчик команды /myplayers
   * Показывает подтвержденных игроков организатора
   */
  static async handleMyPlayers(ctx: Context): Promise<void> {
    await CommandHandlers.handleMyPlayers(ctx);
  }

  /**
   * Обработчик команды /pendingplayers
   * Показывает игроков, ожидающих подтверждения
   */
  static async handlePendingPlayers(ctx: Context): Promise<void> {
    await CommandHandlers.handlePendingPlayers(ctx);
  }

  /**
   * Обработчик действия confirm_player_*
   * Подтверждает игрока через кнопку
   */
  static async handleConfirmPlayer(ctx: Context, data: string): Promise<void> {
    const playerId = CallbackDataParser.parsePlayerId(data);
    if (!playerId) {
      await ctx.answerCbQuery('Неверный формат действия');
      return;
    }

    await CommandHandlers.handleConfirmPlayer(ctx, playerId);
    await ctx.answerCbQuery('✅ Игрок подтвержден');
  }

  /**
   * Обработчик действия reject_player_*
   * Отклоняет игрока через кнопку
   */
  static async handleRejectPlayer(ctx: Context, data: string): Promise<void> {
    const playerId = CallbackDataParser.parsePlayerId(data);
    if (!playerId) {
      await ctx.answerCbQuery('Неверный формат действия');
      return;
    }

    await CommandHandlers.handleRejectPlayer(ctx, playerId);
    await ctx.answerCbQuery('❌ Игрок отклонен');
  }
}