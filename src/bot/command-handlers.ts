import { Context } from 'telegraf';
import { z } from 'zod';
import { joinGame, leaveGame, markPayment, listGames, closeGame } from '../application/use-cases.js';
import { prisma } from '../infrastructure/prisma.js';
import { formatGameTimeForNotification, formatDateForButton } from '../shared/date-utils.js';
import { ErrorHandler } from '../shared/error-handler.js';
import { userPreferencesService } from '../shared/user-preferences-service.js';
import { getVenueName, getRegistrationStatusName, getPaymentStatusName, getGameStatusName, getOrganizerName } from '../shared/game-constants.js';

const GameIdSchema = z.string().uuid();

export class CommandHandlers {
  static async handleGames(ctx: Context): Promise<void> {
    const games = await listGames();

    if (games.length === 0) {
      const user = await prisma.user.findUnique({ where: { telegramId: ctx.from!.id } });
      const isOrganizer = user ? await prisma.organizer.findUnique({ where: { userId: user.id } }) : null;

      const message = isOrganizer
        ? 'Нет активных игр. Создай новую командой /newgame'
        : 'Нет активных игр. Ждем, когда организаторы создадут новые игры';

      await ctx.reply(message);
      return;
    }

    // Получаем количество регистраций для каждой игры
    const gamesWithRegistrations = await Promise.all(
      games.map(async (game: any) => {
        const confirmedCount = await prisma.registration.count({
          where: {
            gameId: game.id,
            status: 'confirmed'
          }
        });
        return { ...game, confirmedRegistrations: confirmedCount };
      })
    );
    
    const gamesList = gamesWithRegistrations.map((game: any) => {
      const date = formatGameTimeForNotification(game.startsAt);
      const status = getGameStatusName(game._status);
      const level = game.levelTag ? ` (${game.levelTag})` : '';
      const price = game.priceText ? ` - ${game.priceText}` : '';
      const availableSpots = game.capacity - game.confirmedRegistrations;
      const venue = getVenueName(game.venueId);

      return `🎾 ${date}${level}${price}\n${venue}\n${status} (${availableSpots} мест свободно)\nID: \`${game.id}\``;
    }).join('\n\n');

    // Создаем кнопки для каждой игры
    const buttons = gamesWithRegistrations.map((game: any) => [
      { text: `${formatDateForButton(game.startsAt)} 🎾 Присоединиться`, callback_data: `join_game_${game.id}` }
    ]);

    await ctx.reply(`Активные игры:\n\n${gamesList}`, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: buttons }
    });
  }

  static async handleJoin(ctx: Context, gameId: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { telegramId: ctx.from!.id } });
    if (!user) {
      await ctx.reply('Сначала зарегистрируйся командой /start');
      return;
    }

    const validationResult = GameIdSchema.safeParse(gameId);
    if (!validationResult.success) {
      await ctx.reply('Неверный формат ID игры. Используй UUID.');
      return;
    }

    try {
      const result = await joinGame(gameId, user.id!);
      const message = result.status === 'confirmed'
        ? 'Место забронировано ✅'
        : 'Лист ожидания ⏳ (сообщим, если место освободится)';
      await ctx.reply(message);
    } catch (error: any) {
      if (error.code === 'ALREADY_REGISTERED') {
        await ctx.reply('Вы уже зарегистрированы на эту игру');
      } else {
        await ctx.reply(ErrorHandler.mapToUserMessage(error));
      }
    }
  }

  static async handleLeave(ctx: Context, gameId: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { telegramId: ctx.from!.id } });
    if (!user) {
      await ctx.reply('Сначала зарегистрируйся командой /start');
      return;
    }

    const validationResult = GameIdSchema.safeParse(gameId);
    if (!validationResult.success) {
      await ctx.reply('Неверный формат ID игры. Используй UUID.');
      return;
    }

    try {
      await leaveGame(gameId, user.id!);
      await ctx.reply('Запись отменена. Если освободилось место, пригласили следующего.');
    } catch (error: any) {
      await ctx.reply(ErrorHandler.mapToUserMessage(error));
    }
  }

  static async handlePay(ctx: Context, gameId: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { telegramId: ctx.from!.id } });
    if (!user) {
      await ctx.reply('Сначала зарегистрируйся командой /start');
      return;
    }

    const validationResult = GameIdSchema.safeParse(gameId);
    if (!validationResult.success) {
      await ctx.reply('Неверный формат ID игры. Используй UUID.');
      return;
    }

    try {
      await markPayment(gameId, user.id!);
      await ctx.reply('Оплата отмечена 💰 Спасибо!');
    } catch (error: any) {
      if (error.code === 'PAYMENT_WINDOW_NOT_OPEN') {
        await ctx.reply('Окно оплаты еще не открыто');
      } else {
        await ctx.reply(ErrorHandler.mapToUserMessage(error));
      }
    }
  }

  static async handleClose(ctx: Context, gameId: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { telegramId: ctx.from!.id } });
    if (!user) {
      await ctx.reply('Сначала зарегистрируйся командой /start');
      return;
    }

    const organizer = await prisma.organizer.findUnique({ where: { userId: user.id } });
    if (!organizer) {
      await ctx.reply('Ты не зарегистрирован как организатор');
      return;
    }

    const validationResult = GameIdSchema.safeParse(gameId);
    if (!validationResult.success) {
      await ctx.reply('Неверный формат ID игры. Используй UUID.');
      return;
    }

    try {
      await closeGame(gameId, organizer.id);
      await ctx.reply('Игра закрыта для новых записей 🔒');
    } catch (error: any) {
      await ctx.reply(ErrorHandler.mapToUserMessage(error));
    }
  }

  static async handleMy(ctx: Context): Promise<void> {
    const telegramId = ctx.from!.id;

    const user = await prisma.user.findUnique({ where: { telegramId } });
    if (!user) {
      await ctx.reply('Сначала зарегистрируйся командой /start');
      return;
    }

    const isOrganizer = await prisma.organizer.findUnique({ where: { userId: user.id } });

    let message = '';
    let buttons: any[] = [];

    // Получить все регистрации пользователя как игрока
    const { GetUserRegistrationsQuery } = await import('../application/queries/GetUserRegistrationsQuery.js');
    const playerQuery = new GetUserRegistrationsQuery(user.id);
    const playerRegistrations = await playerQuery.execute();

    if (playerRegistrations.length > 0) {
      message += '🎾 *Игры как участник:*\n\n';

      const playerGamesList = playerRegistrations.map((reg: any) => {
        const game = reg.game;
        const date = formatGameTimeForNotification(game.startsAt);

        const status = getRegistrationStatusName(reg.status);
        const payment = getPaymentStatusName(reg.paymentStatus);
        const level = game.levelTag ? ` (${game.levelTag})` : '';
        const price = game.priceText ? ` - ${game.priceText}` : '';
        const venue = getVenueName(game.venueId);

        const organizerName = getOrganizerName(game);
        return `🎾 ${date}${level}${price}\n${venue}\n${status} | ${payment}\n${organizerName}ID: \`${game.id}\``;
      }).join('\n\n');

      message += playerGamesList + '\n\n';

      // Кнопки для игр как участника
      const playerButtons = playerRegistrations.map((reg: any) => {
        const game = reg.game;
        const buttonRow = [];

        const buttonDate = formatDateForButton(game.startsAt);

        if (reg.status === 'canceled') {
          // Для отмененных регистраций - кнопка повторного присоединения
          buttonRow.push({
            text: `🔄 ${buttonDate} Присоединиться`,
            callback_data: `join_game_${game.id}`
          });
        } else {
          // Для активных регистраций - кнопка отмены записи
          buttonRow.push({
            text: `❌ ${buttonDate} Отменить`,
            callback_data: `leave_game_${game.id}`
          });

          // Кнопка оплаты, если не оплачено и статус confirmed
          if (reg.paymentStatus === 'unpaid' && reg.status === 'confirmed') {
            buttonRow.push({
              text: `💰 ${buttonDate} Оплатить`,
              callback_data: `pay_game_${game.id}`
            });
          }
        }

        return buttonRow;
      });

      buttons.push(...playerButtons);
    }

    // Если пользователь является организатором, показать созданные им игры
    if (isOrganizer) {
      const organizerGames = await prisma.game.findMany({
        where: { organizerId: isOrganizer.id },
        include: {
          registrations: {
            include: { user: true }
          }
        },
        orderBy: { startsAt: 'asc' }
      });

      if (organizerGames.length > 0) {
        message += '👑 *Созданные игры:*\n\n';

        const organizerGamesList = organizerGames.map((game: any) => {
          const date = formatGameTimeForNotification(game.startsAt);
          const status = getGameStatusName(game.status);
          const level = game.levelTag ? ` (${game.levelTag})` : '';
          const price = game.priceText ? ` - ${game.priceText}` : '';
          const confirmedCount = game.registrations.filter((r: any) => r.status === 'confirmed').length;
          const availableSpots = game.capacity - confirmedCount;
          const venue = getVenueName(game.venueId);

          return `🎾 ${date}${level}${price}\n${venue}\n${status} (${availableSpots} мест свободно)\nУчастников: ${confirmedCount}/${game.capacity}\nID: \`${game.id}\``;
        }).join('\n\n');

        message += organizerGamesList;

        // Кнопки для управления созданными играми
        const organizerButtons = organizerGames.map((game: any) => {
          const buttonDate = formatDateForButton(game.startsAt);
          const buttonRow = [];

          if (game.status === 'open') {
            buttonRow.push({
              text: `🔒 ${buttonDate} Закрыть`,
              callback_data: `close_game_${game.id}`
            });
          }

          buttonRow.push({
            text: `💰 ${buttonDate} Оплаты`,
            callback_data: `payments_game_${game.id}`
          });

          return buttonRow;
        });

        buttons.push(...organizerButtons);
      }
    }

    if (message === '') {
      await ctx.reply('У тебя нет активных регистраций и созданных игр. Найди игру командой /games или создай новую командой /newgame');
      return;
    }

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: buttons.length > 0 ? { inline_keyboard: buttons } : undefined
    });
  }

  static async handlePayments(ctx: Context, gameId: string): Promise<void> {
    const telegramId = ctx.from!.id;

    const user = await prisma.user.findUnique({ where: { telegramId } });
    if (!user) {
      await ctx.reply('Сначала зарегистрируйся командой /start');
      return;
    }

    const organizer = await prisma.organizer.findUnique({ where: { userId: user.id } });
    if (!organizer) {
      await ctx.reply('Ты не зарегистрирован как организатор');
      return;
    }

    const validationResult = GameIdSchema.safeParse(gameId);
    if (!validationResult.success) {
      await ctx.reply('Неверный формат ID игры. Используй UUID.');
      return;
    }

    // Использовать новый query для дашборда
    const { GamePaymentsDashboardQuery } = await import('../application/queries/GamePaymentsDashboardQuery.js');
    const query = new GamePaymentsDashboardQuery(gameId, organizer.id);

    try {
      const dashboard = await query.execute();

      const game = await prisma.game.findUnique({ where: { id: gameId } });
      if (!game) {
        await ctx.reply('Игра не найдена');
        return;
      }

      const date = formatGameTimeForNotification(game.startsAt);

      const payments = dashboard.players.map(player => {
        const paymentStatus = getPaymentStatusName(player.paymentStatus);
        const paymentDate = player.paymentMarkedAt ? ` (${player.paymentMarkedAt.toLocaleDateString('ru-RU')})` : '';
        return `${player.name}: ${paymentStatus}${paymentDate}`;
      }).join('\n');

      const buttons = dashboard.unpaidCount > 0 && game.startsAt < new Date() ? [
        [{ text: '📢 Отправить напоминания', callback_data: `remind_payments_${gameId}` }]
      ] : [];

      await ctx.reply(
        `💰 Статус оплат для игры ${date}\n\n${payments}\n\nОплачено: ${dashboard.paidCount}/${dashboard.players.length}`,
        {
          parse_mode: 'Markdown',
          reply_markup: buttons.length > 0 ? { inline_keyboard: buttons } : undefined
        }
      );
    } catch (error) {
      await ctx.reply('Не удалось получить данные об оплатах');
    }
  }

  static async handleSettings(ctx: Context): Promise<void> {
    const telegramId = ctx.from!.id;

    const user = await prisma.user.findUnique({ where: { telegramId } });
    if (!user) {
      await ctx.reply('Сначала зарегистрируйся командой /start');
      return;
    }

    try {
      const prefs = await userPreferencesService.getPreferences(user.id);

      const settingsText = `
🔔 Настройки уведомлений:

🌐 Глобальные уведомления: ${prefs.globalNotifications ? '✅ Включены' : '❌ Отключены'}

💰 Автоматические напоминания об оплате: ${prefs.paymentRemindersAuto ? '✅ Включены' : '❌ Отключены'}
📢 Ручные напоминания об оплате: ${prefs.paymentRemindersManual ? '✅ Включены' : '❌ Отключены'}

🎾 Напоминания за 24 часа: ${prefs.gameReminders24h ? '✅ Включены' : '❌ Отключены'}
🚨 Напоминания за 2 часа: ${prefs.gameReminders2h ? '✅ Включены' : '❌ Отключены'}

👥 Уведомления организатора: ${prefs.organizerNotifications ? '✅ Включены' : '❌ Отключены'}
      `.trim();

      const buttons = [
        [
          { text: prefs.globalNotifications ? '❌ Отключить все' : '✅ Включить все', callback_data: 'toggle_global' }
        ],
        [
          { text: '💰 Оплаты', callback_data: 'settings_payments' },
          { text: '🎾 Игры', callback_data: 'settings_games' }
        ],
        [
          { text: '👥 Организатор', callback_data: 'settings_organizer' }
        ]
      ];

      await ctx.reply(settingsText, {
        reply_markup: { inline_keyboard: buttons }
      });
    } catch (error) {
      await ctx.reply('Не удалось загрузить настройки');
    }
  }
}