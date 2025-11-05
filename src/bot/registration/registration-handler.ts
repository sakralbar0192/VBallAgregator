import { Context } from 'telegraf';
import { BaseHandler } from '../common/base-handler.js';
import { registerUser, registerOrganizer } from '../../application/use-cases.js';
import { LoggerFactory } from '../../shared/layer-logger.js';
import { LOG_MESSAGES } from '../../shared/logging-messages.js';
import { KeyboardBuilder } from '../common/keyboard-builder.js';

/**
 * Обработчик регистрации пользователей
 */
export class RegistrationHandler extends BaseHandler {
  protected static override logger = LoggerFactory.bot('registration-handler');

  /**
   * Обработчик команды /start
   * Регистрирует пользователя и предлагает выбрать роль
   */
  static async handleStart(ctx: Context): Promise<void> {
    const telegramId = ctx.from!.id;
    const name = ctx.from!.first_name + (ctx.from!.last_name ? ' ' + ctx.from!.last_name : '');
    const correlationId = RegistrationHandler.createCorrelationId(ctx, 'start');

    RegistrationHandler.logger.info('handleUserStart', LOG_MESSAGES.BOT.START_COMMAND_INITIATED,
      { telegramId, name },
      { correlationId }
    );

    try {
      RegistrationHandler.logger.entry('registerUser', { telegramId, name, correlationId });
      const result = await registerUser(telegramId, name);
      RegistrationHandler.logger.exit('registerUser', { userId: result.userId, correlationId });

      await ctx.reply('Привет! Я бот для организации волейбольных игр. Выбери свою роль:', {
        reply_markup: {
          inline_keyboard: KeyboardBuilder.createRoleSelectionKeyboard()
        }
      });

    } catch (error) {
      RegistrationHandler.logger.error('handleUserStart', LOG_MESSAGES.BOT.START_COMMAND_FAILED,
        error as Error,
        { telegramId, error: (error as Error).message },
        { correlationId }
      );
      throw error;
    }
  }

  /**
   * Обработчик выбора роли организатора
   * Регистрирует пользователя как организатора
   */
  static async handleRoleOrganizer(ctx: Context): Promise<void> {
    const telegramId = ctx.from!.id;
    const correlationId = RegistrationHandler.createCorrelationId(ctx, 'role_organizer');

    try {
      const user = await RegistrationHandler.requireUser(ctx);

      await registerOrganizer(user.id, ctx.from!.first_name);

      await ctx.editMessageText('Ты зарегистрирован как организатор! Создай игру командой /newgame');

    } catch (error) {
      RegistrationHandler.logger.error('handleRoleOrganizer', 'Failed to register organizer',
        error as Error,
        { telegramId, correlationId }
      );
      throw error;
    }
  }
}