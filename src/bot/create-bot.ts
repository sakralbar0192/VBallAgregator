import { Telegraf } from 'telegraf';
import rateLimit from 'telegraf-ratelimit';
import {
  BotModuleRegistry,
  RegistrationModule,
  GameManagementModule,
  PaymentModule,
  ProfileModule,
  SettingsModule,
  InvitationsModule,
  CommonModule
} from './modules/index.js';

export type CreateBotOptions = {
  token?: string;
  /** Отключить rate limit (для e2e и локальной отладки) */
  skipRateLimit?: boolean;
};

/**
 * Создаёт экземпляр бота с полным набором модулей (без запуска polling/webhook).
 */
export async function createBot(options?: CreateBotOptions): Promise<Telegraf> {
  const token = options?.token ?? process.env.TELEGRAM_BOT_TOKEN!;
  const bot = new Telegraf(token);

  const skipRateLimit =
    options?.skipRateLimit === true || process.env.E2E_TESTS === 'true';
  if (!skipRateLimit) {
    const limitConfig = { in: 2, out: 1, unique: true };
    bot.use(rateLimit(limitConfig));
  }

  const registry = new BotModuleRegistry();
  registry.registerModule(new RegistrationModule());
  registry.registerModule(new GameManagementModule());
  registry.registerModule(new PaymentModule());
  registry.registerModule(new ProfileModule());
  registry.registerModule(new SettingsModule());
  registry.registerModule(new InvitationsModule());
  registry.registerModule(new CommonModule());

  await registry.initializeAll(bot);

  return bot;
}
