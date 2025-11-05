import { Context } from 'telegraf';
import { BaseHandler } from '../common/base-handler.js';
import { LoggerFactory } from '../../shared/layer-logger.js';
import { CallbackDataParser } from '../common/callback-parser.js';
import { prisma } from '../../infrastructure/prisma.js';

/**
 * Обработчик напоминаний об оплате
 */
export class PaymentReminderHandler extends BaseHandler {
  protected static override logger = LoggerFactory.bot('payment-reminder-handler');

  /**
   * Обработчик действия remind_payments_*
   * Отправляет напоминания об оплате всем участникам игры
   */
  static async handleSendReminders(ctx: Context, gameId: string): Promise<void> {
    const telegramId = ctx.from!.id;

    try {
      const organizer = await PaymentReminderHandler.requireOrganizer(ctx);

      const { sendPaymentReminders } = await import('../../application/use-cases.js');
      await sendPaymentReminders(gameId, organizer.id!);

      await ctx.answerCbQuery('Напоминания отправлены!');
      if (ctx.callbackQuery?.message && 'text' in ctx.callbackQuery.message) {
        await ctx.editMessageText(ctx.callbackQuery.message.text + '\n\n✅ Напоминания отправлены!', {
          parse_mode: 'Markdown'
        });
      }
    } catch (error) {
      PaymentReminderHandler.logger.error('handleSendReminders', 'Failed to send payment reminders',
        error as Error,
        { telegramId, gameId }
      );
      await ctx.answerCbQuery('Ошибка при отправке напоминаний');
    }
  }

  /**
   * Обработчик callback действия remind_payments_*
   */
  static async handleRemindPaymentsCallback(ctx: Context, data: string): Promise<void> {
    const gameId = CallbackDataParser.parseRemindPaymentsGameId(data);
    if (!gameId) {
      await ctx.answerCbQuery('Неверный формат действия');
      return;
    }

    await PaymentReminderHandler.handleSendReminders(ctx, gameId);
  }
}