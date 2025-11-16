import { Telegraf } from 'telegraf';
import type { Context } from 'telegraf';

/**
 * Интерфейс для модуля бота
 */
export interface IBotModule {
  name: string;
  register(bot: Telegraf<Context>): Promise<void>;
}

/**
 * Реестр модулей бота для управления регистрацией обработчиков
 */
export class BotModuleRegistry {
  private modules: IBotModule[] = [];

  /**
   * Регистрирует модуль в реестре
   */
  registerModule(module: IBotModule): void {
    this.modules.push(module);
  }

  /**
   * Инициализирует все зарегистрированные модули
   */
  async initializeAll(bot: Telegraf<Context>): Promise<void> {
    for (const module of this.modules) {
      console.log(`[BotModuleRegistry] Инициализация модуля: ${module.name}`);
      await module.register(bot);
    }
    console.log(`[BotModuleRegistry] Все ${this.modules.length} модулей инициализированы`);
  }

  /**
   * Получает список зарегистрированных модулей
   */
  getModules(): IBotModule[] {
    return [...this.modules];
  }
}
