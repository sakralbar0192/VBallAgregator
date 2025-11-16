import { Telegraf, Context } from 'telegraf';
import { IBotModule } from './bot-module-registry.js';
import { PaymentHandler, PaymentReminderHandler } from '../payments/index.js';
import { CommandValidator } from '../common/index.js';

/**
 * Модуль управления платежами
 */
export class PaymentModule implements IBotModule {
  name = 'PaymentModule';

  async register(bot: Telegraf<Context>): Promise<void> {
    // Команды платежей
    bot.command('pay', async (ctx) => {
      const gameId = await CommandValidator.validateAndExtractGameId(ctx, 'pay');
      await PaymentHandler.handlePay(ctx, gameId);
    });

    bot.command('payments', async (ctx) => {
      const gameId = await CommandValidator.validateAndExtractGameId(ctx, 'payments');
      await PaymentHandler.handlePayments(ctx, gameId);
    });

    // Обработчики callback'ов для платежей
    bot.action(/^remind_payments_(.+)$/, async (ctx) => {
      await PaymentReminderHandler.handleRemindPaymentsCallback(ctx, ctx.match[0]);
    });
  }
}
