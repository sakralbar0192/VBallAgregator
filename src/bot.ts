import { Telegraf } from 'telegraf';
import { joinGame, leaveGame, markPayment, createGame } from './application/use-cases.js';
import { prisma } from './infrastructure/prisma.js';

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);

bot.start(async (ctx) => {
  const telegramId = ctx.from.id;
  const name = ctx.from.first_name + (ctx.from.last_name ? ' ' + ctx.from.last_name : '');

  // Create or update user
  await prisma.user.upsert({
    where: { telegramId },
    update: { name },
    create: { telegramId, name }
  });

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

  // First ensure user exists
  const user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user) {
    return ctx.editMessageText('Пользователь не найден. Начни с команды /start');
  }

  await prisma.user.update({
    where: { telegramId },
    data: { levelTag: level }
  });

  await ctx.editMessageText('Отлично! Теперь ты можешь искать игры командой /games');
});

bot.action('role_organizer', async (ctx) => {
  const telegramId = ctx.from!.id;

  await prisma.organizer.upsert({
    where: { userId: (await prisma.user.findUnique({ where: { telegramId } }))!.id },
    update: {},
    create: {
      userId: (await prisma.user.findUnique({ where: { telegramId } }))!.id,
      title: ctx.from!.first_name
    }
  });

  await ctx.editMessageText('Ты зарегистрирован как организатор! Создай игру командой /newgame');
});

bot.command('games', async (ctx) => {
  // TODO: Implement games listing
  await ctx.reply('Список игр будет здесь...');
});

bot.command('join', async (ctx) => {
  const args = ctx.message.text.split(' ');
  if (args.length < 2) {
    return ctx.reply('Использование: /join <game_id>');
  }

  const gameId = args[1] || "";
  const user = await prisma.user.findUnique({ where: { telegramId: ctx.from!.id } });
  if (!user) return ctx.reply('Сначала зарегистрируйся командой /start');

  try {
    const result = await joinGame(gameId, user.id!);
    const message = result.status === 'confirmed'
      ? 'Место забронировано ✅'
      : 'Лист ожидания ⏳ (сообщим, если место освободится)';
    await ctx.reply(message);
  } catch (error: any) {
    await ctx.reply(`Ошибка: ${error.message}`);
  }
});

bot.command('leave', async (ctx) => {
  const args = ctx.message.text.split(' ');
  if (args.length < 2) {
    return ctx.reply('Использование: /leave <game_id>');
  }

  const gameId = args[1] || "";
  const user = await prisma.user.findUnique({ where: { telegramId: ctx.from!.id } });
  if (!user) return ctx.reply('Сначала зарегистрируйся командой /start');

  try {
    await leaveGame(gameId, user.id!);
    await ctx.reply('Запись отменена. Если освободилось место, пригласили следующего.');
  } catch (error: any) {
    await ctx.reply(`Ошибка: ${error.message}`);
  }
});

bot.command('pay', async (ctx) => {
  const args = ctx.message.text.split(' ');
  if (args.length < 2) {
    return ctx.reply('Использование: /pay <game_id>');
  }

  const gameId = args[1] || "";
  const user = await prisma.user.findUnique({ where: { telegramId: ctx.from!.id } });
  if (!user) return ctx.reply('Сначала зарегистрируйся командой /start');

  try {
    await markPayment(gameId, user.id!);
    await ctx.reply('Оплата отмечена 💰 Спасибо!');
  } catch (error: any) {
    await ctx.reply(`Ошибка: ${error.message}`);
  }
});

export { bot };