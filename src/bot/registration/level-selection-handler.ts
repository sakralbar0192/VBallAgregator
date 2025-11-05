import { Context } from 'telegraf';
import { BaseHandler } from '../common/base-handler.js';
import { updateUserLevel } from '../../application/use-cases.js';
import { LoggerFactory } from '../../shared/layer-logger.js';
import { KeyboardBuilder } from '../common/keyboard-builder.js';
import { prisma } from '../../infrastructure/prisma.js';

/**
 * Обработчик выбора уровня мастерства игрока
 */
export class LevelSelectionHandler extends BaseHandler {
  protected static override logger = LoggerFactory.bot('level-selection-handler');

  /**
   * Обработчик выбора роли игрока
   * Предлагает выбрать уровень мастерства
   */
  static async handleRolePlayer(ctx: Context): Promise<void> {
    await ctx.editMessageText('Ты выбрал роль игрока. Теперь оцени свой уровень:', {
      reply_markup: {
        inline_keyboard: KeyboardBuilder.createLevelSelectionKeyboard()
      }
    });
  }

  /**
   * Обработчик выбора уровня мастерства
   * Сохраняет уровень и завершает регистрацию
   */
  static async handleLevelSelection(ctx: Context, level: string): Promise<void> {
    const telegramId = ctx.from!.id;
    const correlationId = LevelSelectionHandler.createCorrelationId(ctx, 'level_selection');
    try {
      const user = await LevelSelectionHandler.requireUser(ctx);

      await updateUserLevel(user.id, level);

      // Проверить, есть ли другие организаторы в сервисе (исключая самого пользователя)
      const organizers = await prisma.organizer.findMany();
      const otherOrganizersCount = organizers.filter(org => org.userId !== user.id).length;

      if (otherOrganizersCount > 0) {
        await ctx.editMessageText('Отлично! Хочешь выбрать организаторов для приоритетных приглашений на игры?', {
          reply_markup: {
            inline_keyboard: KeyboardBuilder.createRegistrationCompletionKeyboard(true)
          }
        });
      } else {
        await ctx.editMessageText('Отлично! Теперь ты можешь искать игры командой /games');
      }

    } catch (error) {
      LevelSelectionHandler.logger.error('handleLevelSelection', 'Failed to update user level',
        error as Error,
        { telegramId, level, correlationId }
      );
      throw error;
    }
  }

  /**
   * Обработчик завершения регистрации без выбора организаторов
   */
  static async handleFinishRegistration(ctx: Context): Promise<void> {
    await ctx.editMessageText('Отлично! Теперь ты можешь искать игры командой /games');
  }
}