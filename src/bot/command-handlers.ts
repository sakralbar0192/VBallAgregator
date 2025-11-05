import { Context } from 'telegraf';
import { z } from 'zod';
import { joinGame, leaveGame, markPayment, listGames, closeGame, selectOrganizers, confirmPlayer, rejectPlayer, getOrganizerPlayers, respondToGameInvitation } from '../application/use-cases.js';
import { prisma } from '../infrastructure/prisma.js';
import { formatGameTimeForNotification, formatDateForButton } from '../shared/date-utils.js';
import { ErrorHandler } from '../shared/error-handler.js';
import { userPreferencesService } from '../shared/user-preferences-service.js';
import { getVenueName, getRegistrationStatusName, getPaymentStatusName, getGameStatusName, getOrganizerName, getLevelName } from '../shared/game-constants.js';

const GameIdSchema = z.string().uuid();

export class CommandHandlers {
  static organizerSelectionSessions = new Map<number, { session: Set<string>, timestamp: number }>();

  // Очистка сессий по таймауту (30 минут)
  private static cleanupSessions(): void {
    const now = Date.now();
    const timeout = 30 * 60 * 1000; // 30 минут

    for (const [telegramId, data] of this.organizerSelectionSessions) {
      if (now - data.timestamp > timeout) {
        this.organizerSelectionSessions.delete(telegramId);
      }
    }
  }
  static async handleGameInfo(ctx: Context, gameId: string): Promise<void> {
    const validationResult = GameIdSchema.safeParse(gameId);
    if (!validationResult.success) {
      await ctx.reply('Неверный формат ID игры. Используй UUID.');
      return;
    }

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        organizer: true,
        registrations: {
          include: { user: true }
        }
      }
    });

    if (!game) {
      await ctx.reply('Игра не найдена');
      return;
    }

    const date = formatGameTimeForNotification(game.startsAt);
    const status = getGameStatusName(game.status);
    const level = getLevelName(game.levelTag || "") ?? '';
    const price = game.priceText ? ` - ${game.priceText}` : '';
    const venue = getVenueName(game.venueId);
    const organizer = game.organizer.title

    const confirmedCount = game.registrations.filter((r: any) => r.status === 'confirmed').length;
    const waitlistedCount = game.registrations.filter((r: any) => r.status === 'waitlisted').length;

    const organizerName = getOrganizerName(game);

    let message = `🎾 ${date}${level}${price}\n${venue}\n${status}\n${organizer}\n\n`;
    message += `Участников: ${confirmedCount}/${game.capacity}\n`;
    if (waitlistedCount > 0) {
      message += `В ожидании: ${waitlistedCount}\n`;
    }
    message += `${organizerName}ID: \`${game.id}\``;

    await ctx.reply(message, { parse_mode: 'Markdown' });
  }

  static async handleGames(ctx: Context): Promise<void> {
    const user = await prisma.user.findUnique({ where: { telegramId: ctx.from!.id } });
    const userId = user?.id;
    const games = await listGames(userId);

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
          { text: '👥 Организатор', callback_data: 'settings_organizer' },
          { text: '🔗 Выбрать организаторов', callback_data: 'settings_select_organizers' }
        ]
      ];

      await ctx.reply(settingsText, {
        reply_markup: { inline_keyboard: buttons }
      });
    } catch (error) {
      await ctx.reply('Не удалось загрузить настройки');
    }
  }

  static async handleSelectOrganizers(ctx: Context, organizerIds: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { telegramId: ctx.from!.id } });
    if (!user) {
      await ctx.reply('Сначала зарегистрируйся командой /start');
      return;
    }

    const ids = organizerIds.split(',').map(id => id.trim()).filter(id => id);
    if (ids.length === 0) {
      await ctx.reply('Укажи ID организаторов через запятую. Пример: /selectorganizers uuid1,uuid2');
      return;
    }

    try {
      await selectOrganizers(user.id, ids);
      await ctx.reply('Запросы отправлены организаторам. Ожидай подтверждения ✅');
    } catch (error: any) {
      await ctx.reply(ErrorHandler.mapToUserMessage(error));
    }
  }

  static async handleMyOrganizers(ctx: Context): Promise<void> {
    const user = await prisma.user.findUnique({ where: { telegramId: ctx.from!.id } });
    if (!user) {
      await ctx.reply('Сначала зарегистрируйся командой /start');
      return;
    }

    try {
      // Получить все связи игрока с организаторами
      const playerOrganizers = await (prisma as any).playerOrganizer.findMany({
        where: { playerId: user.id },
        include: {
          organizer: {
            include: { user: true }
          }
        },
        orderBy: { requestedAt: 'desc' }
      });

      if (playerOrganizers.length === 0) {
        await ctx.reply('У тебя нет связей с организаторами. Выбери организаторов командой /selectorganizers');
        return;
      }

      const organizersList = playerOrganizers.map((po: any) => {
        const statusText = po.status === 'confirmed' ? '✅ Подтвержден' :
                          po.status === 'pending' ? '⏳ Ожидает' : '❌ Отклонен';
        const organizerName = po.organizer.title || po.organizer.user.name;
        return `${organizerName}: ${statusText}`;
      }).join('\n');

      await ctx.reply(`👥 Мои организаторы:\n\n${organizersList}`, { parse_mode: 'Markdown' });
    } catch (error: any) {
      await ctx.reply('Не удалось получить список организаторов');
    }
  }

  static async handleRespondToGame(ctx: Context, args: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { telegramId: ctx.from!.id } });
    if (!user) {
      await ctx.reply('Сначала зарегистрируйся командой /start');
      return;
    }

    const parts = args.split(' ');
    if (parts.length !== 2) {
      await ctx.reply('Формат: /respondtogame <game_id> <yes/no>');
      return;
    }

    const [gameId, response] = parts;
    const validationResult = GameIdSchema.safeParse(gameId);
    if (!validationResult.success) {
      await ctx.reply('Неверный формат ID игры');
      return;
    }

    if (!response || !['yes', 'no'].includes(response.toLowerCase())) {
      await ctx.reply('Ответ должен быть "yes" или "no"');
      return;
    }

    try {
      await respondToGameInvitation(gameId || "", user.id!, response.toLowerCase());
      const responseText = response.toLowerCase() === 'yes' ? '✅ Да' : '❌ Нет';
      await ctx.reply(`Ответ "${responseText}" отправлен организатору`);
    } catch (error: any) {
      await ctx.reply(ErrorHandler.mapToUserMessage(error));
    }
  }

  static async handleMyPlayers(ctx: Context): Promise<void> {
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

    try {
      const players = await getOrganizerPlayers(organizer.id, 'confirmed');

      if (players.length === 0) {
        await ctx.reply('У тебя нет подтвержденных игроков. Используй /pendingplayers для просмотра ожидающих подтверждения');
        return;
      }

      const playersList = players.map((player: any) =>
        `${player.playerName} (${player.levelTag || 'Без уровня'})`
      ).join('\n');

      await ctx.reply(`👥 Мои подтвержденные игроки:\n\n${playersList}`, { parse_mode: 'Markdown' });
    } catch (error: any) {
      await ctx.reply('Не удалось получить список игроков');
    }
  }

  static async handlePendingPlayers(ctx: Context): Promise<void> {
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

    try {
      const players = await getOrganizerPlayers(organizer.id, 'pending');

      if (players.length === 0) {
        await ctx.reply('Нет игроков, ожидающих подтверждения');
        return;
      }

      const playersList = players.map((player: any) =>
        `${player.playerName} (${player.levelTag || 'Без уровня'})`
      ).join('\n');

      const message = `⏳ Игроки, ожидающие подтверждения:\n\n${playersList}`;

      // Создать кнопки для каждого игрока
      const buttons = players.map((player: any) => [
        {
          text: `✅ ${player.playerName}`,
          callback_data: `confirm_player_${player.playerId}`
        },
        {
          text: `❌ ${player.playerName}`,
          callback_data: `reject_player_${player.playerId}`
        }
      ]);

      await ctx.reply(message, {
        reply_markup: { inline_keyboard: buttons }
      });
    } catch (error: any) {
      await ctx.reply('Не удалось получить список игроков');
    }
  }

  static async handleConfirmPlayer(ctx: Context, playerId: string): Promise<void> {
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

    const validationResult = z.string().uuid().safeParse(playerId);
    if (!validationResult.success) {
      await ctx.reply('Неверный формат ID игрока');
      return;
    }

    try {
      await confirmPlayer(organizer.id, playerId);
      await ctx.reply('Игрок подтвержден ✅');
    } catch (error: any) {
      await ctx.reply(ErrorHandler.mapToUserMessage(error));
    }
  }

  static async handleRejectPlayer(ctx: Context, playerId: string): Promise<void> {
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

    const validationResult = z.string().uuid().safeParse(playerId);
    if (!validationResult.success) {
      await ctx.reply('Неверный формат ID игрока');
      return;
    }

    try {
      await rejectPlayer(organizer.id, playerId);
      await ctx.reply('Игрок отклонен ❌');
    } catch (error: any) {
      await ctx.reply(ErrorHandler.mapToUserMessage(error));
    }
  }

  static async handleHelp(ctx: Context): Promise<void> {
    const telegramId = ctx.from!.id;

    const user = await prisma.user.findUnique({ where: { telegramId } });
    if (!user) {
      await ctx.reply('Сначала зарегистрируйся командой /start');
      return;
    }

    const isOrganizer = await prisma.organizer.findUnique({ where: { userId: user.id } });

    // Проверить, является ли пользователь игроком
    const hasPlayerRegistrations = user.levelTag;

    let helpText = '🎾 Доступные команды:\n\n';

    // Общие команды
    helpText += 'Общие команды:\n';
    helpText += '/start - Регистрация в боте\n';
    helpText += '/games - Список активных игр\n';
    helpText += '/game ID - Информация об игре\n';
    helpText += '/my - Мои игры и регистрации\n\n';

    // Команды для игроков, если пользователь имеет регистрации
    if (hasPlayerRegistrations) {
      helpText += 'Команды для игроков:\n';
      helpText += '/join ID - Записаться на игру\n';
      helpText += '/leave ID - Отменить запись\n';
      helpText += '/pay ID - Отметить оплату\n';
      helpText += '/selectorganizers - Выбрать организаторов\n';
      helpText += '/myorganizers - Мои организаторы\n';
      helpText += '/respondtogame GAME_ID yes/no - Ответить на приглашение\n\n';
    }

    // Команды для организаторов
    if (isOrganizer) {
      helpText += 'Команды для организаторов:\n';
      helpText += '/newgame - Создать новую игру\n';
      helpText += '/close ID - Закрыть запись на игру\n';
      helpText += '/payments ID - Статус оплат участников\n';
      helpText += '/myplayers - Мои подтвержденные игроки\n';
      helpText += '/pendingplayers - Игроки, ожидающие подтверждения\n';
    }

    await ctx.reply(helpText);
  }

  static async handleSelectOrganizersSettings(ctx: Context): Promise<void> {
    const user = await prisma.user.findUnique({ where: { telegramId: ctx.from!.id } });
    if (!user) {
      await ctx.reply('Сначала зарегистрируйся командой /start');
      return;
    }

    try {
      // Очистить старые сессии перед началом
      this.cleanupSessions();

      // Инициализировать сессию с текущими выбранными организаторами из БД
      const telegramId = ctx.from!.id;
      const existingOrganizers = await (prisma as any).playerOrganizer.findMany({
        where: { playerId: user.id },
        select: { organizerId: true }
      });
      const selectedIds = new Set<string>(existingOrganizers.map((po: any) => String(po.organizerId)));

      this.organizerSelectionSessions.set(telegramId, {
        session: selectedIds,
        timestamp: Date.now()
      });

      const buttons = await this.buildOrganizerSelectionButtons(user.id, telegramId);

      if (buttons.length === 0) {
        await ctx.reply('Нет доступных организаторов');
        return;
      }

      await ctx.reply('🔗 Выбери организаторов:', {
        reply_markup: { inline_keyboard: buttons }
      });
    } catch (error: any) {
      await ctx.reply('Не удалось загрузить список организаторов');
    }
  }

  static async handleToggleOrganizer(ctx: Context, organizerId: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { telegramId: ctx.from!.id } });
    if (!user) {
      await ctx.answerCbQuery('Пользователь не найден');
      return;
    }

    try {
      const telegramId = ctx.from!.id;
      let sessionData = this.organizerSelectionSessions.get(telegramId);
      if (!sessionData) {
        sessionData = { session: new Set<string>(), timestamp: Date.now() };
        this.organizerSelectionSessions.set(telegramId, sessionData);
      }

      if (sessionData.session.has(organizerId)) {
        sessionData.session.delete(organizerId);
      } else {
        sessionData.session.add(organizerId);
      }

      // Обновить timestamp
      sessionData.timestamp = Date.now();

      const buttons = await this.buildOrganizerSelectionButtons(user.id, telegramId);

      // Обновить сообщение вместо отправки нового
      await ctx.editMessageText('🔗 Выбери организаторов:', {
        reply_markup: { inline_keyboard: buttons }
      });
      await ctx.answerCbQuery('✅ Выбор обновлен');
    } catch (error: any) {
      await ctx.answerCbQuery('Ошибка при обновлении выбора');
    }
  }

  private static async buildOrganizerSelectionButtons(userId: string, telegramId: number): Promise<any[]> {
    // Получить всех организаторов, исключая самого пользователя, если он организатор
    const organizers = await prisma.organizer.findMany({
      where: {
        userId: {
          not: userId
        }
      },
      include: { user: true },
      orderBy: { user: { name: 'asc' } }
    });

    if (organizers.length === 0) {
      return [];
    }

    // Получить выбранные организаторы из сессии
    const sessionData = this.organizerSelectionSessions.get(telegramId);
    const selectedOrganizerIds = sessionData ? sessionData.session : new Set<string>();

    // Создать кнопки для каждого организатора
    const buttons = organizers.map((org: any) => {
      const isSelected = selectedOrganizerIds.has(org.id);
      const checkmark = isSelected ? '✅' : '☐';
      const organizerName = org.title || org.user.name;
      return [
        {
          text: `${checkmark} ${organizerName}`,
          callback_data: `toggle_organizer_${org.id}`
        }
      ];
    });

    // Добавить кнопку "Готово"
    buttons.push([
      { text: '✅ Готово', callback_data: 'organizers_done' }
    ]);

    return buttons;
  }
}