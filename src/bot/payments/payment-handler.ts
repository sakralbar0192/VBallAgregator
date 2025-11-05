import { Context } from 'telegraf';
import { BaseHandler } from '../common/base-handler.js';
import { LoggerFactory } from '../../shared/layer-logger.js';
import { CommandHandlers } from '../command-handlers.js';

/**
 * Обработчик платежей и статусов оплаты
 */
export class PaymentHandler extends BaseHandler {
  protected static override logger = LoggerFactory.bot('payment-handler');

  /**
   * Обработчик команды /pay <game_id>
   * Отмечает оплату за игру
   */
  static async handlePay(ctx: Context, gameId: string): Promise<void> {
    if (!PaymentHandler.validateGameId(gameId)) {
      await ctx.reply('Неверный формат ID игры');
      return;
    }
    await CommandHandlers.handlePay(ctx, gameId);
  }

  /**
   * Обработчик команды /payments <game_id>
   * Показывает статус оплат для игры (только для организатора)
   */
  static async handlePayments(ctx: Context, gameId: string): Promise<void> {
    if (!PaymentHandler.validateGameId(gameId)) {
      await ctx.reply('Неверный формат ID игры');
      return;
    }
    await CommandHandlers.handlePayments(ctx, gameId);
  }
}