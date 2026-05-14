import { Context } from 'telegraf';
import { BaseHandler } from './base-handler.js';
import { LoggerFactory } from '../../../../core/src/shared/layer-logger.js';
import { CommandHandlers } from '../command-handlers.js';
import { ValidationError, BusinessRuleError, SystemError } from '../../../../core/src/domain/errors/index.js';
import { KeyboardBuilder } from './keyboard-builder.js';
import { prisma } from '../../../../core/src/infrastructure/prisma.js';

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
   * Обработчик команды /menu
   * Показывает палитру основных команд
   */
  static async handleMenu(ctx: Context): Promise<void> {
    const telegramId = ctx.from!.id;

    const user = await prisma.user.findUnique({ where: { telegramId } });
    if (!user) {
      await ctx.reply('Сначала зарегистрируйся командой /start');
      return;
    }

    const isOrganizer = await prisma.organizer.findUnique({ where: { userId: user.id } });
    const hasPlayerRegistrations = user.levelTag !== null;

    const userInfo = {
      isOrganizer: !!isOrganizer,
      hasPlayerRegistrations
    };

    const buttons = KeyboardBuilder.createMainCommandPalette(userInfo);

    await ctx.reply(
      '🎾 *Палитра команд*\n\nВыбери нужное действие:',
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: buttons }
      }
    );
  }

  /**
   * Обработчик callback'ов от палитры команд
   */
  static async handleCommandPaletteCallback(ctx: any): Promise<void> {
    const callbackData = ctx.match?.[0];
    if (!callbackData) {
      await ctx.answerCbQuery('Ошибка обработки команды');
      return;
    }
    
    try {
      switch (callbackData) {
        case 'cmd_games':
          await CommandHandlers.handleGames(ctx);
          break;
        case 'cmd_my':
          await CommandHandlers.handleMy(ctx);
          break;
        case 'cmd_settings':
          await CommandHandlers.handleSettings(ctx);
          break;
        case 'cmd_myorganizers':
          await CommandHandlers.handleMyOrganizers(ctx);
          break;
        case 'cmd_newgame':
          const { GameCreationWizard } = await import('../game-creation-wizard.js');
          await GameCreationWizard.start(ctx);
          break;
        case 'cmd_myplayers':
          await CommandHandlers.handleMyPlayers(ctx);
          break;
        case 'cmd_help':
          await CommandHandlers.handleHelp(ctx);
          break;
        default:
          await ctx.answerCbQuery('Неизвестная команда');
          return;
      }

      // Подтверждаем callback
      await ctx.answerCbQuery('✅ Выполнено');
    } catch (error) {
      this.logger.error('handleCommandPaletteCallback', 'Error handling command palette callback', error as Error, { callbackData });
      await ctx.answerCbQuery('❌ Ошибка выполнения команды');
    }
  }

  /**
   * Обработчик неизвестных команд
   */
  static async handleUnknownCommand(ctx: Context): Promise<void> {
    // Обработка неизвестных команд
    if (ctx.message && 'text' in ctx.message && ctx.message.text?.startsWith('/')) {
      await ctx.reply('Неизвестная команда. Используй /help для просмотра доступных команд или /menu для быстрого доступа к командам.');
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