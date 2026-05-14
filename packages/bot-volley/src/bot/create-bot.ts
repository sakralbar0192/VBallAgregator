import { Telegraf, Scenes, session } from 'telegraf';
import type { RedisClientType } from 'redis';
import rateLimit from 'telegraf-ratelimit';
import { createConnectedRedisSessionStore } from './telegraf-redis-session-store.js';
import { getRacketScenes } from '../../../bot-racket/src/racket-scenes.js';
import {
  BotModuleRegistry,
  RegistrationModule,
  GameManagementModule,
  PaymentModule,
  ProfileModule,
  SettingsModule,
  InvitationsModule,
  CommonModule,
} from './modules/index.js';

export type CreateBotOptions = {
  token?: string;
  skipRateLimit?: boolean;
  sessionRedis?: RedisClientType;
};

export async function createBot(options?: CreateBotOptions): Promise<Telegraf> {
  const token = options?.token ?? process.env.TELEGRAM_BOT_TOKEN!;
  const bot = new Telegraf(token);

  const skipRateLimit =
    options?.skipRateLimit === true || process.env.E2E_TESTS === 'true';
  if (!skipRateLimit) {
    bot.use(rateLimit({ in: 2, out: 1, unique: true }));
  }

  if (options?.sessionRedis) {
    const store = createConnectedRedisSessionStore(options.sessionRedis, 'tg:sess:');
    bot.use(session({ store: store as never, defaultSession: () => ({}) }) as never);
  } else {
    bot.use(session({ defaultSession: () => ({}) }) as never);
  }

  const stage = new Scenes.Stage([...getRacketScenes()]);
  bot.use(stage.middleware() as never);

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
