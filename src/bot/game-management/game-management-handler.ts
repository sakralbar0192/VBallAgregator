import { Context } from 'telegraf';
import { BaseHandler } from '../common/base-handler.js';
import { LoggerFactory } from '../../shared/layer-logger.js';
import { CommandHandlers } from '../command-handlers.js';
import { CallbackDataParser } from '../common/callback-parser.js';

/**
 * Обработчик управления играми (список, информация, действия)
 */
export class GameManagementHandler extends BaseHandler {
  protected static override logger = LoggerFactory.bot('game-management-handler');

  /**
   * Обработчик команды /games
   * Показывает список доступных игр
   */
  static async handleGames(ctx: Context): Promise<void> {
    await CommandHandlers.handleGames(ctx);
  }

  /**
   * Обработчик команды /game <game_id>
   * Показывает подробную информацию об игре
   */
  static async handleGameInfo(ctx: Context, gameId: string): Promise<void> {
    if (!this.validateGameId(gameId)) {
      await ctx.reply('Неверный формат ID игры');
      return;
    }
    await CommandHandlers.handleGameInfo(ctx, gameId);
  }

  /**
   * Обработчик команды /join <game_id>
   * Позволяет пользователю записаться на игру
   */
  static async handleJoin(ctx: Context, gameId: string): Promise<void> {
    if (!this.validateGameId(gameId)) {
      await ctx.reply('Неверный формат ID игры');
      return;
    }
    await CommandHandlers.handleJoin(ctx, gameId);
  }

  /**
   * Обработчик команды /close <game_id>
   * Закрывает игру (только для организатора)
   */
  static async handleClose(ctx: Context, gameId: string): Promise<void> {
    if (!this.validateGameId(gameId)) {
      await ctx.reply('Неверный формат ID игры');
      return;
    }
    await CommandHandlers.handleClose(ctx, gameId);
  }

  /**
   * Обработчик команды /leave <game_id>
   * Отменяет запись на игру
   */
  static async handleLeave(ctx: Context, gameId: string): Promise<void> {
    if (!this.validateGameId(gameId)) {
      await ctx.reply('Неверный формат ID игры');
      return;
    }
    await CommandHandlers.handleLeave(ctx, gameId);
  }

  /**
   * Обработчик callback действий с играми
   */
  static async handleGameAction(ctx: Context, action: string): Promise<void> {
    const gameId = CallbackDataParser.parseGameId(action) ||
                   CallbackDataParser.parseCloseGameId(action) ||
                   CallbackDataParser.parseLeaveGameId(action) ||
                   CallbackDataParser.parsePayGameId(action) ||
                   CallbackDataParser.parsePaymentsGameId(action);

    if (!gameId) {
      await ctx.answerCbQuery('Неверный формат действия');
      return;
    }

    if (action.startsWith('join_game_')) {
      await this.handleJoin(ctx, gameId);
    } else if (action.startsWith('leave_game_')) {
      await this.handleLeave(ctx, gameId);
    } else if (action.startsWith('close_game_')) {
      await this.handleClose(ctx, gameId);
    } else if (action.startsWith('pay_game_')) {
      await CommandHandlers.handlePay(ctx, gameId);
    } else if (action.startsWith('payments_game_')) {
      await CommandHandlers.handlePayments(ctx, gameId);
    }
  }
}