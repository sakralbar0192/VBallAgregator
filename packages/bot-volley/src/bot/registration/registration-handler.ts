import { Context, Scenes } from 'telegraf';
import { BaseHandler } from '../common/base-handler.js';
import { registerUser, registerOrganizer, setUserActiveSport } from '../../../../core/src/application/use-cases.js';
import { LoggerFactory } from '../../../../core/src/shared/layer-logger.js';
import { LOG_MESSAGES } from '../../../../core/src/shared/logging-messages.js';
import { KeyboardBuilder } from '../common/keyboard-builder.js';
import { sessionManager } from '../../../../core/src/shared/session-manager.js';

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

      // Create a new session for the user
      const session = sessionManager.create(result.userId.toString());
      session.data.telegramId = telegramId;
      session.data.name = name;

      await ctx.reply(
        'Привет! Я бот для организации спортивных игр. Сначала выбери вид спорта.',
        {
          reply_markup: {
            inline_keyboard: KeyboardBuilder.createSportSelectionKeyboard(),
          },
        },
      );

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
   * Выбор вида спорта: волейбол
   */
  static async handleSportVolleyball(ctx: Context): Promise<void> {
    const telegramId = ctx.from!.id;
    const correlationId = RegistrationHandler.createCorrelationId(ctx, 'sport_volleyball');
    try {
      await ctx.answerCbQuery();
      const user = await RegistrationHandler.requireUser(ctx);
      await setUserActiveSport(user.id, 'volleyball');
      await ctx.editMessageText('Волейбол. Теперь выбери роль:');
      await ctx.reply('Роль:', {
        reply_markup: { inline_keyboard: KeyboardBuilder.createRoleSelectionKeyboard() },
      });
    } catch (error) {
      RegistrationHandler.logger.error('handleSportVolleyball', 'sport volleyball failed', error as Error, { telegramId, correlationId });
      throw error;
    }
  }

  /**
   * Выбор вида спорта: ракетки
   */
  static async handleSportRacket(ctx: Context): Promise<void> {
    const telegramId = ctx.from!.id;
    const correlationId = RegistrationHandler.createCorrelationId(ctx, 'sport_racket');
    try {
      await ctx.answerCbQuery();
      const user = await RegistrationHandler.requireUser(ctx);
      await setUserActiveSport(user.id, 'racket');
      await ctx.editMessageText('Ракеточные игры. Короткий профиль для подбора:');
      await (ctx as unknown as Scenes.SceneContext).scene.enter('racket-profile');
    } catch (error) {
      RegistrationHandler.logger.error('handleSportRacket', 'sport racket failed', error as Error, { telegramId, correlationId });
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
      const session = sessionManager.getCurrentSession();

      if (!session) {
        throw new Error('No active session found');
      }

      await registerOrganizer(user.id, ctx.from!.first_name);
      session.data.role = 'organizer';

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