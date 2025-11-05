import { Context } from 'telegraf';

/**
 * Валидаторы для команд бота
 */
export class CommandValidator {
  /**
   * Валидирует команду с одним аргументом (game_id)
   */
  static validateSingleArgCommand(ctx: Context, commandName: string): string | null {
    if (!ctx.message || !('text' in ctx.message)) {
      return null;
    }
    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
      return null;
    }
    return args[1] || "";
  }

  /**
   * Валидирует команду с аргументами после команды
   */
  static validateMultiArgCommand(ctx: Context): string {
    if (!ctx.message || !('text' in ctx.message)) {
      return '';
    }
    const args = ctx.message.text.split(' ').slice(1).join(' ');
    return args;
  }

  /**
   * Проверяет, что строка является валидным UUID
   */
  static isValidUUID(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }

  /**
   * Создает сообщение об ошибке для команды без аргументов
   */
  static createUsageMessage(commandName: string, usage: string): string {
    return `Использование: /${commandName} ${usage}`;
  }

  /**
   * Валидирует gameId и возвращает его или null
   */
  static validateGameId(gameId: string): string | null {
    if (!gameId || !this.isValidUUID(gameId)) {
      return null;
    }
    return gameId;
  }

  /**
   * Валидирует команду и возвращает gameId с обработкой ошибок
   */
  static async validateAndExtractGameId(ctx: Context, commandName: string): Promise<string> {
    const gameId = this.validateSingleArgCommand(ctx, commandName);
    if (!gameId) {
      await ctx.reply(this.createUsageMessage(commandName, '<game_id>'));
      throw new Error(`Invalid command usage: /${commandName}`);
    }

    const validGameId = this.validateGameId(gameId);
    if (!validGameId) {
      await ctx.reply('Неверный формат ID игры');
      throw new Error(`Invalid game ID format: ${gameId}`);
    }

    return validGameId;
  }
}