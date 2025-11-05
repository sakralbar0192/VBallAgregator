import { Context } from 'telegraf';
import { BaseHandler } from '../common/base-handler.js';
import { LoggerFactory } from '../../shared/layer-logger.js';
import { CommandHandlers } from '../command-handlers.js';
import { CallbackDataParser } from '../common/callback-parser.js';

/**
 * Обработчик выбора организаторов
 */
export class OrganizerSelectionHandler extends BaseHandler {
  protected static override logger = LoggerFactory.bot('organizer-selection-handler');

  /**
   * Обработчик действия select_organizers_registration
   * Показывает выбор организаторов после регистрации
   */
  static async handleSelectOrganizersRegistration(ctx: Context): Promise<void> {
    await CommandHandlers.handleSelectOrganizersSettings(ctx);
  }

  /**
   * Обработчик действия toggle_organizer_*
   * Переключает выбор организатора
   */
  static async handleToggleOrganizer(ctx: Context, data: string): Promise<void> {
    const organizerId = CallbackDataParser.parseOrganizerId(data);
    if (!organizerId) {
      await ctx.answerCbQuery('Неверный формат действия');
      return;
    }

    await CommandHandlers.handleToggleOrganizer(ctx, organizerId);
  }

  /**
   * Обработчик действия organizers_done
   * Завершает выбор организаторов
   */
  static async handleOrganizersDone(ctx: Context): Promise<void> {
    await ctx.answerCbQuery('✅ Выбор организаторов сохранен');
    await ctx.editMessageText('🔗 Выбор организаторов сохранен. Организаторы получат запрос на подтверждение.');
  }
}