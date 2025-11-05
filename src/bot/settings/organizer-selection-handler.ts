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
    OrganizerSelectionHandler.logger.info('handleSelectOrganizersRegistration', 'Handling select organizers registration', { userId: ctx.from?.id });
    await CommandHandlers.handleSelectOrganizersSettings(ctx);
    OrganizerSelectionHandler.logger.info('handleSelectOrganizersRegistration', 'Handled select organizers registration');
  }

  /**
   * Обработчик действия toggle_organizer_*
   * Переключает выбор организатора
   */
  static async handleToggleOrganizer(ctx: Context, data: string): Promise<void> {
    OrganizerSelectionHandler.logger.info('handleToggleOrganizer', 'Handling toggle organizer', { data, userId: ctx.from?.id });
    const organizerId = CallbackDataParser.parseOrganizerId(data);
    if (!organizerId) {
      OrganizerSelectionHandler.logger.warn('handleToggleOrganizer', 'Invalid organizer id format', { data });
      await ctx.answerCbQuery('Неверный формат действия');
      return;
    }

    await CommandHandlers.handleToggleOrganizer(ctx, organizerId);
    OrganizerSelectionHandler.logger.info('handleToggleOrganizer', 'Handled toggle organizer', { organizerId });
  }

  /**
   * Обработчик действия organizers_done
   * Завершает выбор организаторов
   */
  static async handleOrganizersDone(ctx: Context): Promise<void> {
    OrganizerSelectionHandler.logger.info('handleOrganizersDone', 'Handling organizers done', { userId: ctx.from?.id });
    const { CommandHandlers } = await import('../command-handlers.js');
    const { prisma } = await import('../../infrastructure/prisma.js');
    const { selectOrganizers } = await import('../../application/use-cases.js');

    const user = await prisma.user.findUnique({
      where: { telegramId: ctx.from!.id }
    });
    if (!user) {
      OrganizerSelectionHandler.logger.warn('handleOrganizersDone', 'User not found', { telegramId: ctx.from!.id });
      await ctx.answerCbQuery('Пользователь не найден');
      return;
    }

    try {
      const telegramId = ctx.from!.id;
      const sessionData = CommandHandlers.organizerSelectionSessions.get(telegramId);
      const session = sessionData ? sessionData.session : new Set<string>();

      const organizerIds = Array.from(session);

      OrganizerSelectionHandler.logger.info('handleOrganizersDone', 'Saving organizer selection', { userId: user.id, organizerIds });

      // Сохранить выбор в БД
      await selectOrganizers(user.id, organizerIds);

      // Очистить сессию
      CommandHandlers.organizerSelectionSessions.delete(telegramId);

      OrganizerSelectionHandler.logger.info('handleOrganizersDone', 'Organizer selection saved successfully');
      await ctx.answerCbQuery('✅ Выбор организаторов сохранен');
      const message = organizerIds.length > 0
        ? '🔗 Выбор организаторов сохранен. Организаторы получат запрос на подтверждение.'
        : '🔗 Все связи с организаторами удалены.';
      await ctx.editMessageText(message);
    } catch (error: any) {
      OrganizerSelectionHandler.logger.error('handleOrganizersDone', 'Error saving organizer selection', error);
      await ctx.answerCbQuery('Ошибка при сохранении выбора');
    }
  }
}