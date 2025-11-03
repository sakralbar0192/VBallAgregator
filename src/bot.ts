import { Telegraf } from 'telegraf';
import { joinGame, leaveGame, markPayment, createGame, registerUser, updateUserLevel, registerOrganizer, listGames } from './application/use-cases.js';
import { prisma } from './infrastructure/prisma.js';

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);

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
  const games = await listGames();

  if (games.length === 0) {
    return ctx.reply('Нет активных игр. Создай новую командой /newgame');
  }

  const gamesList = games.map((game: any) => {
    const date = game.startsAt.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
    const status = game.status === 'open' ? '🟢 Открыта' : game.status === 'closed' ? '🔴 Закрыта' : '✅ Завершена';
    const level = game.levelTag ? ` (${game.levelTag})` : '';
    const price = game.priceText ? ` - ${game.priceText}` : '';

    return `🎾 ${date}${level}${price}\n${status}\nID: \`${game.id}\``;
  }).join('\n\n');

  await ctx.reply(`Активные игры:\n\n${gamesList}`, { parse_mode: 'Markdown' });
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

bot.command('newgame', async (ctx: any) => {
  const telegramId = ctx.from!.id;

  const user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user) return ctx.reply('Сначала зарегистрируйся командой /start');

  const organizer = await prisma.organizer.findUnique({ where: { userId: user.id } });
  if (!organizer) return ctx.reply('Ты не зарегистрирован как организатор. Выбери роль организатора в /start');

  // Simple inline keyboard for venue selection (hardcoded for now)
  await ctx.reply('Выбери площадку для игры:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Стадион "Волна"', callback_data: 'venue_volna' }],
        [{ text: 'СК "Олимп"', callback_data: 'venue_olimp' }],
        [{ text: 'Парк "Южный"', callback_data: 'venue_south' }]
      ]
    }
  });
});

bot.action(/^venue_(.+)$/, async (ctx: any) => {
  const venueKey = ctx.match[1];
  const telegramId = ctx.from!.id;

  const user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user) return ctx.editMessageText('Пользователь не найден');

  // Map venue keys to IDs (hardcoded)
  const venueMap: Record<string, string> = {
    volna: 'venue-volna-id',
    olimp: 'venue-olimp-id',
    south: 'venue-south-id'
  };

  const venueId = venueMap[venueKey];
  if (!venueId) return ctx.editMessageText('Площадка не найдена');

  // Create game with default values
  const startsAt = new Date();
  startsAt.setHours(startsAt.getHours() + 2); // Game in 2 hours

  try {
    const game = await createGame({
      organizerId: user.id!,
      venueId,
      startsAt,
      capacity: 12,
      levelTag: 'amateur',
      priceText: '500₽'
    });

    await ctx.editMessageText(`Игра создана! ID: \`${game.id}\`\n\nРасскажи друзьям, чтобы они могли присоединиться командой /join ${game.id}`, { parse_mode: 'Markdown' });
  } catch (error: any) {
    await ctx.editMessageText(`Ошибка создания игры: ${error.message}`);
  }
});

bot.on('text', async (ctx) => {
  // Обработка неизвестных команд
  if (ctx.message.text?.startsWith('/')) {
    await ctx.reply('Неизвестная команда. Доступные команды:\n/start - регистрация\n/games - список игр\n/join <id> - записаться\n/leave <id> - отменить запись\n/pay <id> - отметить оплату\n/newgame - создать игру\n/my - мои игры');
  }
});
bot.command('my', async (ctx) => {
  const telegramId = ctx.from!.id;

  const user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user) return ctx.reply('Сначала зарегистрируйся командой /start');

  // Получить все регистрации пользователя
  const registrations = await prisma.registration.findMany({
    where: { userId: user.id },
    include: {
      game: {
        include: {
          organizer: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  if (registrations.length === 0) {
    return ctx.reply('У тебя нет активных регистраций. Найди игру командой /games');
  }

  const gamesList = registrations.map((reg: any) => {
    const game = reg.game;
    const date = game.startsAt.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });

    const status = reg.status === 'confirmed' ? '✅ Подтвержден' :
                   reg.status === 'waitlisted' ? '⏳ В ожидании' : '❌ Отменен';
    const payment = reg.paymentStatus === 'paid' ? '💰 Оплачено' : '⏳ Не оплачено';
    const level = game.levelTag ? ` (${game.levelTag})` : '';
    const price = game.priceText ? ` - ${game.priceText}` : '';

    return `🎾 ${date}${level}${price}\n${status} | ${payment}\nОрганизатор: ${game.organizer.title}\nID: \`${game.id}\``;
  }).join('\n\n');

  await ctx.reply(`Твои игры:\n\n${gamesList}`, { parse_mode: 'Markdown' });
});

bot.catch((err, ctx) => {
  console.error('Bot error:', err);
  ctx.reply('Произошла ошибка. Попробуй позже.');
});