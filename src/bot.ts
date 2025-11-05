import { Telegraf } from 'telegraf';
import { registerUser, updateUserLevel, registerOrganizer } from './application/use-cases.js';
import { GameCreationWizard } from './bot/game-creation-wizard.js';
import { CommandHandlers } from './bot/command-handlers.js';
import { prisma } from './infrastructure/prisma.js';
import { LoggerFactory } from './shared/layer-logger.js';
import { LOG_MESSAGES } from './shared/logging-messages.js';

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
  const correlationId = `start_${telegramId}_${Date.now()}`;

  const botLogger = LoggerFactory.bot('start-handler');

  botLogger.info('handleUserStart', LOG_MESSAGES.BOT.START_COMMAND_INITIATED,
   { telegramId: Number(telegramId), firstName: ctx.from.first_name },
   { correlationId }
 );

  try {
    botLogger.entry('registerUser', { telegramId, name, correlationId });
    const result = await registerUser(telegramId, name);
    botLogger.exit('registerUser', { userId: result.userId, correlationId });

    await ctx.reply('Привет! Я бот для организации волейбольных игр. Выбери свою роль:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Игрок', callback_data: 'role_player' }],
          [{ text: 'Организатор', callback_data: 'role_organizer' }]
        ]
      }
    });

  } catch (error) {
    botLogger.error('handleUserStart', LOG_MESSAGES.BOT.START_COMMAND_FAILED,
      error as Error,
      { telegramId, error: (error as Error).message },
      { correlationId }
    );
    throw error;
  }
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

  // Проверить, есть ли организаторы в сервисе
  const organizersCount = await prisma.organizer.count();
  if (organizersCount > 0) {
    await ctx.editMessageText('Отлично! Хочешь выбрать организаторов для приоритетных приглашений на игры?', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔗 Выбрать организаторов', callback_data: 'select_organizers_registration' }],
          [{ text: '✅ Завершить регистрацию', callback_data: 'finish_registration' }]
        ]
      }
    });
  } else {
    await ctx.editMessageText('Отлично! Теперь ты можешь искать игры командой /games');
  }
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
 * Обработчик команды /help
 * Показывает доступные команды в зависимости от роли пользователя
 * @param ctx - Контекст Telegraf
 */
bot.command('help', async (ctx) => {
  await CommandHandlers.handleHelp(ctx);
});

/**
 * Обработчик команды /game <game_id>
 * Показывает подробную информацию об игре
 * @param ctx - Контекст Telegraf
 * @param gameId - UUID игры
 */
bot.command('game', async (ctx) => {
  const args = ctx.message.text.split(' ');
  if (args.length < 2) {
    return ctx.reply('Использование: /game <game_id>');
  }

  const gameId = args[1] || "";
  await CommandHandlers.handleGameInfo(ctx, gameId);
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

/**
 * Обработчик команды /myorganizers
 * Показывает список организаторов игрока
 * @param ctx - Контекст Telegraf
 */
bot.command('myorganizers', async (ctx) => {
  await CommandHandlers.handleMyOrganizers(ctx);
});

/**
 * Обработчик команды /respondtogame <game_id> <yes/no>
 * Позволяет ответить на приглашение к игре
 * @param ctx - Контекст Telegraf
 * @param args - game_id и ответ (yes/no)
 */
bot.command('respondtogame', async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1).join(' ');
  await CommandHandlers.handleRespondToGame(ctx, args);
});

/**
 * Обработчик команды /myplayers
 * Показывает подтвержденных игроков организатора
 * @param ctx - Контекст Telegraf
 */
bot.command('myplayers', async (ctx) => {
  await CommandHandlers.handleMyPlayers(ctx);
});

/**
 * Обработчик команды /pendingplayers
 * Показывает игроков, ожидающих подтверждения
 * @param ctx - Контекст Telegraf
 */
bot.command('pendingplayers', async (ctx) => {
  await CommandHandlers.handlePendingPlayers(ctx);
});

/**
 * Обработчик действия selectorganizers
 * Показывает список организаторов для выбора
 * @param ctx - Контекст Telegraf
 */
bot.command('selectorganizers', async (ctx) => {
  await CommandHandlers.handleSelectOrganizersSettings(ctx);
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

/**
 * Обработчик действия toggle_organizer_*
 * Переключает выбор организатора
 * @param ctx - Контекст Telegraf
 * @param organizerId - ID организатора
 */
bot.action(/^toggle_organizer_(.+)$/, async (ctx) => {
  const organizerId = ctx.match[1] as string;
  await CommandHandlers.handleToggleOrganizer(ctx, organizerId);
});

/**
 * Обработчик действия organizers_done
 * Завершает выбор организаторов
 * @param ctx - Контекст Telegraf
 */
bot.action('organizers_done', async (ctx) => {
  await ctx.answerCbQuery('✅ Выбор организаторов сохранен');
  await ctx.editMessageText('🔗 Выбор организаторов сохранен. Организаторы получат запрос на подтверждение.');
});

/**
 * Обработчик действия select_organizers_registration
 * Показывает выбор организаторов после регистрации
 * @param ctx - Контекст Telegraf
 */
bot.action('select_organizers_registration', async (ctx) => {
  await CommandHandlers.handleSelectOrganizersSettings(ctx);
});

/**
 * Обработчик действия finish_registration
 * Завершает регистрацию без выбора организаторов
 * @param ctx - Контекст Telegraf
 */
bot.action('finish_registration', async (ctx) => {
  await ctx.editMessageText('Отлично! Теперь ты можешь искать игры командой /games');
});

/**
 * Обработчик действия toggle_global
 * Переключает глобальные уведомления
 * @param ctx - Контекст Telegraf
 */
bot.action('toggle_global', async (ctx) => {
  const user = await prisma.user.findUnique({ where: { telegramId: ctx.from!.id } });
  if (!user) {
    return ctx.answerCbQuery('Пользователь не найден');
  }

  try {
    const { userPreferencesService } = await import('./shared/user-preferences-service.js');
    const prefs = await userPreferencesService.getPreferences(user.id);
    await userPreferencesService.updatePreferences(user.id, {
      ...prefs,
      globalNotifications: !prefs.globalNotifications
    });

    await ctx.answerCbQuery('✅ Настройки обновлены');
    await CommandHandlers.handleSettings(ctx);
  } catch (error) {
    await ctx.answerCbQuery('Ошибка при обновлении настроек');
  }
});

/**
 * Обработчик действия settings_payments
 * Показывает настройки уведомлений об оплате
 * @param ctx - Контекст Telegraf
 */
bot.action('settings_payments', async (ctx) => {
  const user = await prisma.user.findUnique({ where: { telegramId: ctx.from!.id } });
  if (!user) {
    return ctx.answerCbQuery('Пользователь не найден');
  }

  try {
    const { userPreferencesService } = await import('./shared/user-preferences-service.js');
    const prefs = await userPreferencesService.getPreferences(user.id);

    const settingsText = `
💰 Настройки уведомлений об оплате:

🤖 Автоматические напоминания: ${prefs.paymentRemindersAuto ? '✅ Включены' : '❌ Отключены'}
📢 Ручные напоминания: ${prefs.paymentRemindersManual ? '✅ Включены' : '❌ Отключены'}
    `.trim();

    const buttons = [
      [
        {
          text: prefs.paymentRemindersAuto ? '❌ Отключить авто' : '✅ Включить авто',
          callback_data: 'toggle_payment_auto'
        }
      ],
      [
        {
          text: prefs.paymentRemindersManual ? '❌ Отключить ручные' : '✅ Включить ручные',
          callback_data: 'toggle_payment_manual'
        }
      ],
      [
        { text: '⬅️ Назад', callback_data: 'back_to_settings' }
      ]
    ];

    await ctx.editMessageText(settingsText, {
      reply_markup: { inline_keyboard: buttons }
    });
  } catch (error) {
    await ctx.answerCbQuery('Ошибка при загрузке настроек');
  }
});

/**
 * Обработчик действия settings_games
 * Показывает настройки уведомлений об играх
 * @param ctx - Контекст Telegraf
 */
bot.action('settings_games', async (ctx) => {
  const user = await prisma.user.findUnique({ where: { telegramId: ctx.from!.id } });
  if (!user) {
    return ctx.answerCbQuery('Пользователь не найден');
  }

  try {
    const { userPreferencesService } = await import('./shared/user-preferences-service.js');
    const prefs = await userPreferencesService.getPreferences(user.id);

    const settingsText = `
🎾 Настройки уведомлений об играх:

⏰ Напоминания за 24 часа: ${prefs.gameReminders24h ? '✅ Включены' : '❌ Отключены'}
🚨 Напоминания за 2 часа: ${prefs.gameReminders2h ? '✅ Включены' : '❌ Отключены'}
    `.trim();

    const buttons = [
      [
        {
          text: prefs.gameReminders24h ? '❌ Отключить 24ч' : '✅ Включить 24ч',
          callback_data: 'toggle_game_24h'
        }
      ],
      [
        {
          text: prefs.gameReminders2h ? '❌ Отключить 2ч' : '✅ Включить 2ч',
          callback_data: 'toggle_game_2h'
        }
      ],
      [
        { text: '⬅️ Назад', callback_data: 'back_to_settings' }
      ]
    ];

    await ctx.editMessageText(settingsText, {
      reply_markup: { inline_keyboard: buttons }
    });
  } catch (error) {
    await ctx.answerCbQuery('Ошибка при загрузке настроек');
  }
});

/**
 * Обработчик действия settings_organizer
 * Показывает настройки уведомлений организатора
 * @param ctx - Контекст Telegraf
 */
bot.action('settings_organizer', async (ctx) => {
  const user = await prisma.user.findUnique({ where: { telegramId: ctx.from!.id } });
  if (!user) {
    return ctx.answerCbQuery('Пользователь не найден');
  }

  try {
    const { userPreferencesService } = await import('./shared/user-preferences-service.js');
    const prefs = await userPreferencesService.getPreferences(user.id);

    const settingsText = `
👥 Настройки уведомлений организатора:

📬 Уведомления организатора: ${prefs.organizerNotifications ? '✅ Включены' : '❌ Отключены'}
    `.trim();

    const buttons = [
      [
        {
          text: prefs.organizerNotifications ? '❌ Отключить' : '✅ Включить',
          callback_data: 'toggle_organizer_notifications'
        }
      ],
      [
        { text: '⬅️ Назад', callback_data: 'back_to_settings' }
      ]
    ];

    await ctx.editMessageText(settingsText, {
      reply_markup: { inline_keyboard: buttons }
    });
  } catch (error) {
    await ctx.answerCbQuery('Ошибка при загрузке настроек');
  }
});

/**
 * Обработчик действия back_to_settings
 * Возвращает в главное меню настроек
 * @param ctx - Контекст Telegraf
 */
bot.action('back_to_settings', async (ctx) => {
  await CommandHandlers.handleSettings(ctx);
});

/**
 * Обработчики переключения настроек
 */
bot.action('toggle_payment_auto', async (ctx) => {
  const user = await prisma.user.findUnique({ where: { telegramId: ctx.from!.id } });
  if (!user) return ctx.answerCbQuery('Пользователь не найден');

  try {
    const { userPreferencesService } = await import('./shared/user-preferences-service.js');
    const prefs = await userPreferencesService.getPreferences(user.id);
    await userPreferencesService.updatePreferences(user.id, {
      ...prefs,
      paymentRemindersAuto: !prefs.paymentRemindersAuto
    });
    await ctx.answerCbQuery('✅ Настройка обновлена');
    await ctx.editMessageText('💰 Настройки уведомлений об оплате обновлены');
  } catch (error) {
    await ctx.answerCbQuery('Ошибка');
  }
});

bot.action('toggle_payment_manual', async (ctx) => {
  const user = await prisma.user.findUnique({ where: { telegramId: ctx.from!.id } });
  if (!user) return ctx.answerCbQuery('Пользователь не найден');

  try {
    const { userPreferencesService } = await import('./shared/user-preferences-service.js');
    const prefs = await userPreferencesService.getPreferences(user.id);
    await userPreferencesService.updatePreferences(user.id, {
      ...prefs,
      paymentRemindersManual: !prefs.paymentRemindersManual
    });
    await ctx.answerCbQuery('✅ Настройка обновлена');
    await ctx.editMessageText('💰 Настройки уведомлений об оплате обновлены');
  } catch (error) {
    await ctx.answerCbQuery('Ошибка');
  }
});

bot.action('toggle_game_24h', async (ctx) => {
  const user = await prisma.user.findUnique({ where: { telegramId: ctx.from!.id } });
  if (!user) return ctx.answerCbQuery('Пользователь не найден');

  try {
    const { userPreferencesService } = await import('./shared/user-preferences-service.js');
    const prefs = await userPreferencesService.getPreferences(user.id);
    await userPreferencesService.updatePreferences(user.id, {
      ...prefs,
      gameReminders24h: !prefs.gameReminders24h
    });
    await ctx.answerCbQuery('✅ Настройка обновлена');
    await ctx.editMessageText('🎾 Настройки уведомлений об играх обновлены');
  } catch (error) {
    await ctx.answerCbQuery('Ошибка');
  }
});

bot.action('toggle_game_2h', async (ctx) => {
  const user = await prisma.user.findUnique({ where: { telegramId: ctx.from!.id } });
  if (!user) return ctx.answerCbQuery('Пользователь не найден');

  try {
    const { userPreferencesService } = await import('./shared/user-preferences-service.js');
    const prefs = await userPreferencesService.getPreferences(user.id);
    await userPreferencesService.updatePreferences(user.id, {
      ...prefs,
      gameReminders2h: !prefs.gameReminders2h
    });
    await ctx.answerCbQuery('✅ Настройка обновлена');
    await ctx.editMessageText('🎾 Настройки уведомлений об играх обновлены');
  } catch (error) {
    await ctx.answerCbQuery('Ошибка');
  }
});

bot.action('toggle_organizer_notifications', async (ctx) => {
  const user = await prisma.user.findUnique({ where: { telegramId: ctx.from!.id } });
  if (!user) return ctx.answerCbQuery('Пользователь не найден');

  try {
    const { userPreferencesService } = await import('./shared/user-preferences-service.js');
    const prefs = await userPreferencesService.getPreferences(user.id);
    await userPreferencesService.updatePreferences(user.id, {
      ...prefs,
      organizerNotifications: !prefs.organizerNotifications
    });
    await ctx.answerCbQuery('✅ Настройка обновлена');
    await ctx.editMessageText('👥 Настройки уведомлений организатора обновлены');
  } catch (error) {
    await ctx.answerCbQuery('Ошибка');
  }
});

/**
 * Обработчик действия confirm_player_*
 * Подтверждает игрока через кнопку
 * @param ctx - Контекст Telegraf
 * @param playerId - ID игрока
 */
bot.action(/^confirm_player_(.+)$/, async (ctx) => {
  const playerId = ctx.match[1] as string;
  await CommandHandlers.handleConfirmPlayer(ctx, playerId);
  await ctx.answerCbQuery('✅ Игрок подтвержден');
});

/**
 * Обработчик действия reject_player_*
 * Отклоняет игрока через кнопку
 * @param ctx - Контекст Telegraf
 * @param playerId - ID игрока
 */
bot.action(/^reject_player_(.+)$/, async (ctx) => {
  const playerId = ctx.match[1] as string;
  await CommandHandlers.handleRejectPlayer(ctx, playerId);
  await ctx.answerCbQuery('❌ Игрок отклонен');
});

/**
 * Обработчик действия respond_game_*_yes
 * Ответ "Да" на приглашение к игре
 * @param ctx - Контекст Telegraf
 * @param gameId - ID игры
 */
bot.action(/^respond_game_(.+)_yes$/, async (ctx) => {
  const gameId = ctx.match[1] as string;
  const user = await prisma.user.findUnique({ where: { telegramId: ctx.from!.id } });
  if (!user) {
    return ctx.answerCbQuery('Пользователь не найден');
  }

  try {
    const { respondToGameInvitation } = await import('./application/use-cases.js');
    await respondToGameInvitation(gameId, user.id, 'yes');
    await ctx.answerCbQuery('✅ Ответ "Да" отправлен');
    await ctx.editMessageText('✅ Вы ответили "Да" на приглашение!');
  } catch (error: any) {
    await ctx.answerCbQuery('Ошибка при отправке ответа');
  }
});

/**
 * Обработчик действия respond_game_*_no
 * Ответ "Нет" на приглашение к игре
 * @param ctx - Контекст Telegraf
 * @param gameId - ID игры
 */
bot.action(/^respond_game_(.+)_no$/, async (ctx) => {
  const gameId = ctx.match[1] as string;
  const user = await prisma.user.findUnique({ where: { telegramId: ctx.from!.id } });
  if (!user) {
    return ctx.answerCbQuery('Пользователь не найден');
  }

  try {
    const { respondToGameInvitation } = await import('./application/use-cases.js');
    await respondToGameInvitation(gameId, user.id, 'no');
    await ctx.answerCbQuery('❌ Ответ "Нет" отправлен');
    await ctx.editMessageText('❌ Вы ответили "Нет" на приглашение!');
  } catch (error: any) {
    await ctx.answerCbQuery('Ошибка при отправке ответа');
  }
});

bot.on('text', async (ctx) => {
  // Обработка неизвестных команд
  if (ctx.message.text?.startsWith('/')) {
    await ctx.reply('Неизвестная команда. Используй /help для просмотра доступных команд.');
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