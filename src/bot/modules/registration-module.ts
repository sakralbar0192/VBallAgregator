import { Telegraf, Context } from 'telegraf';
import { IBotModule } from './bot-module-registry.js';
import { RegistrationHandler, LevelSelectionHandler } from '../registration/index.js';
import { CallbackDataParser } from '../common/index.js';
import { OrganizerSelectionHandler } from '../settings/index.js';

/**
 * Модуль регистрации пользователей
 */
export class RegistrationModule implements IBotModule {
  name = 'RegistrationModule';

  async register(bot: Telegraf<Context>): Promise<void> {
    // Команда старта
    bot.start(RegistrationHandler.handleStart);

    // Выбор роли
    bot.action('role_player', LevelSelectionHandler.handleRolePlayer);
    bot.action('role_organizer', RegistrationHandler.handleRoleOrganizer);

    // Выбор уровня
    bot.action(/^level_(.+)$/, async (ctx) => {
      const level = CallbackDataParser.parseLevel(ctx.match[0]!);
      if (level) {
        await LevelSelectionHandler.handleLevelSelection(ctx, level);
      }
    });

    // Выбор организаторов при регистрации
    bot.action('select_organizers_registration', OrganizerSelectionHandler.handleSelectOrganizersRegistration);

    // Завершение регистрации
    bot.action('finish_registration', LevelSelectionHandler.handleFinishRegistration);
  }
}
