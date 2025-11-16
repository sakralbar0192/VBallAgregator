import { Telegraf, Context } from 'telegraf';
import { IBotModule } from './bot-module-registry.js';
import { CommonHandlers } from '../common/index.js';

/**
 * Модуль общих обработчиков (помощь, меню, обработка ошибок)
 */
export class CommonModule implements IBotModule {
  name = 'CommonModule';

  async register(bot: Telegraf<Context>): Promise<void> {
    // Команда помощи
    bot.command('help', CommonHandlers.handleHelp);

    // Команда меню/палитры команд
    bot.command('menu', CommonHandlers.handleMenu);

    // Обработчики callback'ов палитры команд
    bot.action(/^cmd_(.+)$/, CommonHandlers.handleCommandPaletteCallback);

    // Обработчики текстовых сообщений
    bot.on('text', CommonHandlers.handleUnknownCommand);

    // Глобальный обработчик ошибок
    bot.catch((err: unknown, ctx) => CommonHandlers.handleError(err as Error, ctx));
  }
}
