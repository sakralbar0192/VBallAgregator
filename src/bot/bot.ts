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

/**
 * Инициализирует бота с модульной архитектурой
 */
async function initializeBot(): Promise<Telegraf> {
  const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);

  // Применяем rate limiting
  const limitConfig = { in: 2, out: 1, unique: true }; // 2 сообщения в секунду
  bot.use(rateLimit(limitConfig));

  // Создаем реестр модулей
  const registry = new BotModuleRegistry();

  // Регистрируем все модули
  registry.registerModule(new RegistrationModule());
  registry.registerModule(new GameManagementModule());
  registry.registerModule(new PaymentModule());
  registry.registerModule(new ProfileModule());
  registry.registerModule(new SettingsModule());
  registry.registerModule(new InvitationsModule());
  registry.registerModule(new CommonModule());

  // Инициализируем все модули
  await registry.initializeAll(bot);

  return bot;
}

// Инициализируем бота при импорте
const bot = await initializeBot();

export default bot;
