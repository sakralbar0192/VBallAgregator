import { Telegraf } from 'telegraf';
import { registerUser, updateUserLevel, registerOrganizer } from './application/use-cases.js';
import { GameCreationWizard } from './bot/game-creation-wizard.js';
import { CommandHandlers } from './bot/command-handlers.js';
import { prisma } from './infrastructure/prisma.js';

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);

// Rate limiting: 2 messages per 1 second per user
import rateLimit from 'telegraf-ratelimit';
const limitConfig = {
  in: 2,        // 2 сообщения
  out: 1,       // за 1 секунду
  unique: true  // per user
};

bot.use(rateLimit(limitConfig));

export { bot };

bot.start(async (ctx) => {
  const telegramId = ctx.from.id;
  const name = ctx.from.first_name + (ctx.from.last_name ? ' ' + ctx.from.last_name : '');

  await registerUser(telegramId, name);

  await ctx.reply('Привет! Я бот для организации волейбольных игр. Выбери свою роль:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Игрок', callback_data: 'role_player' }],
        [{ text: 'Организатор', callback_data: 'role_organizer' }]
      ]
    }
  });
});

bot.action('role_player', async (ctx) => {
  await ctx.editMessageText('Ты выбрал роль игрока. Теперь оцени свой уровень:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Новичок', callback_data: 'level_novice' }],
        [{ text: 'Любитель', callback_data: 'level_amateur' }],
        [{ text: 'Опытный', callback_data: 'level_experienced' }],
        [{ text: 'Профи', callback_data: 'level_pro' }]
      ]
    }
  });
});

bot.action(/^level_(.+)$/, async (ctx) => {
  const level = ctx.match[1];
  const telegramId = ctx.from!.id;

  const user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user || !user.id) {
    return ctx.editMessageText('Пользователь не найден. Начни с команды /start');
  }

  await updateUserLevel(user.id!, level);

  await ctx.editMessageText('Отлично! Теперь ты можешь искать игры командой /games');
});

bot.action('role_organizer', async (ctx) => {
  const telegramId = ctx.from!.id;

  const user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user || !user.id) {
    return ctx.editMessageText('Пользователь не найден. Начни с команды /start');
  }

  await registerOrganizer(user.id, ctx.from!.first_name);

  await ctx.editMessageText('Ты зарегистрирован как организатор! Создай игру командой /newgame');
});

bot.command('games', async (ctx) => {
  await CommandHandlers.handleGames(ctx);
});

bot.command('join', async (ctx) => {
  const args = ctx.message.text.split(' ');
  if (args.length < 2) {
    return ctx.reply('Использование: /join <game_id>');
  }

  const gameId = args[1] || "";
  await CommandHandlers.handleJoin(ctx, gameId);
});

bot.command('close', async (ctx) => {
  const args = ctx.message.text.split(' ');
  if (args.length < 2) {
    return ctx.reply('Использование: /close <game_id>');
  }

  const gameId = args[1] || "";
  await CommandHandlers.handleClose(ctx, gameId);
});

bot.command('leave', async (ctx) => {
  const args = ctx.message.text.split(' ');
  if (args.length < 2) {
    return ctx.reply('Использование: /leave <game_id>');
  }

  const gameId = args[1] || "";
  await CommandHandlers.handleLeave(ctx, gameId);
});

bot.command('pay', async (ctx) => {
  const args = ctx.message.text.split(' ');
  if (args.length < 2) {
    return ctx.reply('Использование: /pay <game_id>');
  }

  const gameId = args[1] || "";
  await CommandHandlers.handlePay(ctx, gameId);
});

bot.command('newgame', async (ctx: any) => {
  await GameCreationWizard.start(ctx);
});

// Обработчики мастера создания игры
bot.action(/^wizard_date_(.+)$/, async (ctx: any) => {
  const dateKey = ctx.match[1];
  await GameCreationWizard.handleDateSelection(ctx, dateKey);
});

bot.action(/^wizard_time_(\d+)$/, async (ctx: any) => {
  const hour = parseInt(ctx.match[1]);
  await GameCreationWizard.handleTimeSelection(ctx, hour);
});

bot.action(/^wizard_level_(.+)$/, async (ctx: any) => {
  const level = ctx.match[1];
  await GameCreationWizard.handleLevelSelection(ctx, level);
});

bot.action(/^wizard_venue_(.+)$/, async (ctx: any) => {
  const venueKey = ctx.match[1];
  await GameCreationWizard.handleVenueSelection(ctx, venueKey);
});

bot.action(/^wizard_capacity_(\d+)$/, async (ctx: any) => {
  const capacity = parseInt(ctx.match[1]);
  await GameCreationWizard.handleCapacitySelection(ctx, capacity);
});

bot.action(/^wizard_price_(.+)$/, async (ctx: any) => {
  const price = ctx.match[1];
  await GameCreationWizard.handlePriceSelection(ctx, price);
});

bot.on('text', async (ctx) => {
  // Обработка неизвестных команд
  if (ctx.message.text?.startsWith('/')) {
    await ctx.reply('Неизвестная команда. Доступные команды:\n/start - регистрация\n/games - список игр\n/join <id> - записаться\n/leave <id> - отменить запись\n/pay <id> - отметить оплату\n/newgame - создать игру\n/my - мои игры\n/payments <id> - статус оплат (организатор)\n/close <id> - закрыть игру (организатор)');
  }
});
bot.command('my', async (ctx) => {
  await CommandHandlers.handleMy(ctx);
});

bot.command('payments', async (ctx) => {
  const args = ctx.message.text.split(' ');
  if (args.length < 2) {
    return ctx.reply('Использование: /payments <game_id>');
  }

  const gameId = args[1] || "";
  await CommandHandlers.handlePayments(ctx, gameId);
});

bot.catch((err, ctx) => {
  console.error('Bot error:', err);
  ctx.reply('Произошла ошибка. Попробуй позже.');
});