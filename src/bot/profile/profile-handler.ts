import { Context } from 'telegraf';
import { BaseHandler } from '../common/base-handler.js';
import { LoggerFactory } from '../../shared/layer-logger.js';
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
}