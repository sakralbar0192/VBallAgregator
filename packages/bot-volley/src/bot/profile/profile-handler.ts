import { Context, Scenes } from 'telegraf';
import { BaseHandler } from '../common/base-handler.js';
import { prisma } from '../../../../core/src/infrastructure/prisma.js';
import { LoggerFactory } from '../../../../core/src/shared/layer-logger.js';
import { CommandHandlers } from '../command-handlers.js';

/**
 * Обработчик личного кабинета пользователя
 */
export class ProfileHandler extends BaseHandler {
  protected static override logger = LoggerFactory.bot('profile-handler');

  /**
   * Обработчик команды /my
   * Показывает игры пользователя (как игрока или организатора)
   */
  static async handleMy(ctx: Context): Promise<void> {
    await CommandHandlers.handleMy(ctx);
  }

  /**
   * Обработчик команды /myorganizers
   * Показывает список организаторов игрока
   */
  static async handleMyOrganizers(ctx: Context): Promise<void> {
    await CommandHandlers.handleMyOrganizers(ctx);
  }

  /**
   * Кнопка «Искать игры» после мастера ракеточного профиля (пока без сценария подбора).
   */
  static async handleRacketSearchGamesPlaceholder(ctx: Context): Promise<void> {
    const telegramId = ctx.from?.id;
    if (telegramId === undefined) return;
    const user = await prisma.user.findUnique({ where: { telegramId: BigInt(telegramId) } });
    if (!user || user.activeSport !== 'racket') return;
    await ctx.reply(
      'Подбор ракеточных игр в боте пока в разработке. Можно пользоваться общими командами бота (например /games, если доступны для твоего режима).',
    );
  }

  /**
   * Reply-клавиатура ракеточного профиля (как в RacketMate): повторный вход в мастер настройки.
   */
  static async handleRacketProfileKeyboard(ctx: Context): Promise<void> {
    const telegramId = ctx.from?.id;
    if (telegramId === undefined) return;
    const user = await prisma.user.findUnique({ where: { telegramId: BigInt(telegramId) } });
    if (!user || user.activeSport !== 'racket') return;
    await (ctx as unknown as Scenes.SceneContext).scene.enter('racket-profile');
  }
}