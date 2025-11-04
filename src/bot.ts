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

/**
 * Обработчик команды /start
 * Регистрирует пользователя и предлагает выбрать роль (игрок или организатор)
 * @param ctx - Контекст Telegraf
 */
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

/**
 * Обработчик действия role_player
 * Предлагает игроку выбрать уровень мастерства
 * @param ctx - Контекст Telegraf
 */
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

/**
 * Обработчик действия level_*
 * Сохраняет выбранный уровень игрока и завершает регистрацию
 * @param ctx - Контекст Telegraf
 * @param level - Уровень мастерства (novice, amateur, experienced, pro)
 * @throws Если пользователь не найден
 */
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

/**
 * Обработчик действия role_organizer
 * Регистрирует пользователя как организатора
 * @param ctx - Контекст Telegraf
 * @throws Если пользователь не найден
 */
bot.action('role_organizer', async (ctx) => {
  const telegramId = ctx.from!.id;

  const user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user || !user.id) {
    return ctx.editMessageText('Пользователь не найден. Начни с команды /start');
  }

  await registerOrganizer(user.id, ctx.from!.first_name);

  await ctx.editMessageText('Ты зарегистрирован как организатор! Создай игру командой /newgame');
});

/**
 * Обработчик команды /games
 * Показывает список доступных игр
 * @param ctx - Контекст Telegraf
 */
bot.command('games', async (ctx) => {
  await CommandHandlers.handleGames(ctx);
});

/**
 * Обработчик команды /join <game_id>
 * Позволяет пользователю записаться на игру
 * @param ctx - Контекст Telegraf
 * @param gameId - UUID игры
 * @throws Если игра не найдена или заполнена
 */
bot.command('join', async (ctx) => {
  const args = ctx.message.text.split(' ');
  if (args.length < 2) {
    return ctx.reply('Использование: /join <game_id>');
  }

  const gameId = args[1] || "";
  await CommandHandlers.handleJoin(ctx, gameId);
});

/**
 * Обработчик команды /close <game_id>
 * Закрывает игру (только для организатора)
 * @param ctx - Контекст Telegraf
 * @param gameId - UUID игры
 * @throws Если пользователь не организатор или игра не найдена
 */
bot.command('close', async (ctx) => {
  const args = ctx.message.text.split(' ');
  if (args.length < 2) {
    return ctx.reply('Использование: /close <game_id>');
  }

  const gameId = args[1] || "";
  await CommandHandlers.handleClose(ctx, gameId);
});

/**
 * Обработчик команды /leave <game_id>
 * Отменяет запись на игру
 * @param ctx - Контекст Telegraf
 * @param gameId - UUID игры
 * @throws Если игра не найдена или пользователь не записан
 */
bot.command('leave', async (ctx) => {
  const args = ctx.message.text.split(' ');
  if (args.length < 2) {
    return ctx.reply('Использование: /leave <game_id>');
  }

  const gameId = args[1] || "";
  await CommandHandlers.handleLeave(ctx, gameId);
});

/**
 * Обработчик команды /pay <game_id>
 * Отмечает оплату за игру
 * @param ctx - Контекст Telegraf
 * @param gameId - UUID игры
 * @throws Если игра не найдена или оплата недоступна
 */
bot.command('pay', async (ctx) => {
  const args = ctx.message.text.split(' ');
  if (args.length < 2) {
    return ctx.reply('Использование: /pay <game_id>');
  }

  const gameId = args[1] || "";
  await CommandHandlers.handlePay(ctx, gameId);
});

/**
 * Обработчик команды /newgame
 * Запускает мастер создания новой игры
 * @param ctx - Контекст Telegraf
 */
bot.command('newgame', async (ctx: any) => {
  await GameCreationWizard.start(ctx);
});

// Обработчики мастера создания игры

/**
 * Обработчик действия wizard_date_*
 * Обрабатывает выбор даты в мастере создания игры
 * @param ctx - Контекст Telegraf
 * @param dateKey - Ключ выбранной даты
 */
bot.action(/^wizard_date_(.+)$/, async (ctx: any) => {
  const dateKey = ctx.match[1];
  await GameCreationWizard.handleDateSelection(ctx, dateKey);
});

/**
 * Обработчик действия wizard_time_*
 * Обрабатывает выбор времени в мастере создания игры
 * @param ctx - Контекст Telegraf
 * @param hour - Выбранный час (0-23)
 */
bot.action(/^wizard_time_(\d+)$/, async (ctx: any) => {
  const hour = parseInt(ctx.match[1]);
  await GameCreationWizard.handleTimeSelection(ctx, hour);
});

/**
 * Обработчик действия wizard_level_*
 * Обрабатывает выбор уровня в мастере создания игры
 * @param ctx - Контекст Telegraf
 * @param level - Уровень игры (novice, amateur, experienced, pro)
 */
bot.action(/^wizard_level_(.+)$/, async (ctx: any) => {
  const level = ctx.match[1];
  await GameCreationWizard.handleLevelSelection(ctx, level);
});

/**
 * Обработчик действия wizard_venue_*
 * Обрабатывает выбор площадки в мастере создания игры
 * @param ctx - Контекст Telegraf
 * @param venueKey - Ключ выбранной площадки
 */
bot.action(/^wizard_venue_(.+)$/, async (ctx: any) => {
  const venueKey = ctx.match[1];
  await GameCreationWizard.handleVenueSelection(ctx, venueKey);
});

/**
 * Обработчик действия wizard_capacity_*
 * Обрабатывает выбор вместимости в мастере создания игры
 * @param ctx - Контекст Telegraf
 * @param capacity - Вместимость игры (число игроков)
 */
bot.action(/^wizard_capacity_(\d+)$/, async (ctx: any) => {
  const capacity = parseInt(ctx.match[1]);
  await GameCreationWizard.handleCapacitySelection(ctx, capacity);
});

/**
 * Обработчик действия wizard_price_*
 * Обрабатывает выбор цены в мастере создания игры
 * @param ctx - Контекст Telegraf
 * @param price - Цена игры
 */
bot.action(/^wizard_price_(.+)$/, async (ctx: any) => {
  const price = ctx.match[1];
  await GameCreationWizard.handlePriceSelection(ctx, price);
});

/**
 * Обработчик команды /my
 * Показывает игры пользователя (как игрока или организатора)
 * @param ctx - Контекст Telegraf
 */
bot.command('my', async (ctx) => {
  await CommandHandlers.handleMy(ctx);
});

/**
 * Обработчик команды /payments <game_id>
 * Показывает статус оплат для игры (только для организатора)
 * @param ctx - Контекст Telegraf
 * @param gameId - UUID игры
 * @throws Если пользователь не организатор или игра не найдена
 */
bot.command('payments', async (ctx) => {
  const args = ctx.message.text.split(' ');
  if (args.length < 2) {
    return ctx.reply('Использование: /payments <game_id>');
  }

  const gameId = args[1] || "";
  await CommandHandlers.handlePayments(ctx, gameId);
});

// Обработчик callback для напоминаний об оплате

/**
 * Обработчик действия remind_payments_*
 * Отправляет напоминания об оплате всем участникам игры
 * @param ctx - Контекст Telegraf
 * @param gameId - UUID игры
 * @throws Если пользователь не организатор или игра не найдена
 */
bot.action(/^remind_payments_(.+)$/, async (ctx) => {
  const gameId = ctx.match[1] as string;
  const telegramId = ctx.from!.id;

  const user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user) {
    return ctx.answerCbQuery('Пользователь не найден');
  }

  const organizer = await prisma.organizer.findUnique({ where: { userId: user.id } });
  if (!organizer) {
    return ctx.answerCbQuery('Ты не организатор этой игры');
  }

  try {
    const { sendPaymentReminders } = await import('./application/use-cases.js');
    await sendPaymentReminders(gameId, organizer.id!);

    await ctx.answerCbQuery('Напоминания отправлены!');
    if (ctx.callbackQuery.message && 'text' in ctx.callbackQuery.message) {
      await ctx.editMessageText(ctx.callbackQuery.message.text + '\n\n✅ Напоминания отправлены!', {
        parse_mode: 'Markdown'
      });
    }
  } catch (error) {
    await ctx.answerCbQuery('Ошибка при отправке напоминаний');
  }
});

/**
 * Обработчик действия join_game_*
 * Позволяет присоединиться к игре через кнопку
 * @param ctx - Контекст Telegraf
 * @param gameId - UUID игры
 */
bot.action(/^join_game_(.+)$/, async (ctx) => {
  const gameId = ctx.match[1] as string;
  await CommandHandlers.handleJoin(ctx, gameId);
});

/**
 * Обработчик действия leave_game_*
 * Позволяет отменить запись на игру через кнопку
 * @param ctx - Контекст Telegraf
 * @param gameId - UUID игры
 */
bot.action(/^leave_game_(.+)$/, async (ctx) => {
  const gameId = ctx.match[1] as string;
  await CommandHandlers.handleLeave(ctx, gameId);
});

/**
 * Обработчик действия pay_game_*
 * Позволяет отметить оплату через кнопку
 * @param ctx - Контекст Telegraf
 * @param gameId - UUID игры
 */
bot.action(/^pay_game_(.+)$/, async (ctx) => {
  const gameId = ctx.match[1] as string;
  await CommandHandlers.handlePay(ctx, gameId);
});

/**
 * Обработчик действия close_game_*
 * Позволяет закрыть игру через кнопку
 * @param ctx - Контекст Telegraf
 * @param gameId - UUID игры
 */
bot.action(/^close_game_(.+)$/, async (ctx) => {
  const gameId = ctx.match[1] as string;
  await CommandHandlers.handleClose(ctx, gameId);
});

/**
 * Обработчик действия payments_game_*
 * Показывает статус оплат для игры
 * @param ctx - Контекст Telegraf
 * @param gameId - UUID игры
 */
bot.action(/^payments_game_(.+)$/, async (ctx) => {
  const gameId = ctx.match[1] as string;
  await CommandHandlers.handlePayments(ctx, gameId);
});

bot.on('text', async (ctx) => {
  // Обработка неизвестных команд
  if (ctx.message.text?.startsWith('/')) {
    await ctx.reply('Неизвестная команда. Доступные команды:\n/start - регистрация\n/games - список игр\n/join <id> - записаться\n/leave <id> - отменить запись\n/pay <id> - отметить оплату\n/newgame - создать игру\n/my - мои игры\n/payments <id> - статус оплат (организатор)\n/close <id> - закрыть игру (организатор)');
  }
});

/**
 * Глобальный обработчик ошибок бота
 * Логирует ошибки и отправляет пользователю сообщение об ошибке
 * @param err - Ошибка
 * @param ctx - Контекст Telegraf
 */
bot.catch((err, ctx) => {
  console.error('Bot error:', err);
  ctx.reply('Произошла ошибка. Попробуй позже.');
});