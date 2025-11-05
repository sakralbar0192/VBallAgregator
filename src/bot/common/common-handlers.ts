import { Context } from 'telegraf';
import { BaseHandler } from './base-handler.js';
import { LoggerFactory } from '../../shared/layer-logger.js';
import { CommandHandlers } from '../command-handlers.js';
import { ValidationError, BusinessRuleError, SystemError } from '../../domain/errors/index.js';

/**
 * Общие обработчики (help, неизвестные команды, ошибки)
 */
export class CommonHandlers extends BaseHandler {
  protected static override logger = LoggerFactory.bot('common-handlers');

  /**
   * Обработчик команды /help
   * Показывает доступные команды в зависимости от роли пользователя
   */
  static async handleHelp(ctx: Context): Promise<void> {
    await CommandHandlers.handleHelp(ctx);
  }

  /**
   * Обработчик неизвестных команд
   */
  static async handleUnknownCommand(ctx: Context): Promise<void> {
    // Обработка неизвестных команд
    if (ctx.message && 'text' in ctx.message && ctx.message.text?.startsWith('/')) {
      await ctx.reply('Неизвестная команда. Используй /help для просмотра доступных команд.');
    }
  }

  /**
   * Глобальный обработчик ошибок бота
   * Логирует ошибки и отправляет пользователю сообщение об ошибке
   */
  static async handleError(err: Error, ctx: Context): Promise<void> {
    const correlationId = `bot_${ctx.from?.id || 'unknown'}_${Date.now()}`;

    if (err instanceof ValidationError) {
      // Ошибки валидации - показываем пользователю что исправить
      await ctx.reply(
        `❌ ${err.getUserMessage()}\n\n` +
        `Исправьте данные и попробуйте снова.`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    if (err instanceof BusinessRuleError) {
      // Ошибки бизнес-правил - объясняем почему нельзя
      await ctx.reply(`❌ ${err.getUserMessage()}`);
      return;
    }

    if (err instanceof SystemError) {
      // Системные ошибки - предлагаем повторить
      await ctx.reply(
        `⚠️ ${err.getUserMessage()}\n\n` +
        `Попробуйте повторить операцию через несколько минут.`
      );
      return;
    }

    // Неожиданные ошибки - логируем и показываем generic сообщение
    console.error('Bot error:', err, { correlationId, ctx: ctx.update });
    await ctx.reply('Произошла неожиданная ошибка. Попробуйте позже.');
  }
}