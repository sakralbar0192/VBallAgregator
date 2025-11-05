  import { Game, GameStatus } from '../domain/game.js';
  import { RegStatus } from '../domain/registration.js';
  import type { GameRepo, RegistrationRepo } from '../infrastructure/repositories.js';
  import { PrismaGameRepo, PrismaRegistrationRepo, PrismaUserRepo } from '../infrastructure/repositories.js';
  import { logger } from '../shared/logger.js';
  import { LoggerFactory } from '../shared/layer-logger.js';
  import { LOG_MESSAGES } from '../shared/logging-messages.js';
  import { DomainError } from '../domain/errors.js';
  import { prisma } from '../infrastructure/prisma.js';
  import { GameApplicationService } from './services/game-service.js';
  import { UserApplicationService } from './services/user-service.js';
  import { EventBus } from '../shared/event-bus.js';
  import { GameDomainService } from '../domain/services/game-domain-service.js';
  import { SchedulerService } from '../shared/scheduler-service.js';

  const gameRepo: GameRepo = new PrismaGameRepo();
  const registrationRepo: RegistrationRepo = new PrismaRegistrationRepo();
  const userRepo = new PrismaUserRepo();

  // Initialize new services
  const eventBus = EventBus.getInstance();
  const gameDomainService = new GameDomainService(gameRepo, registrationRepo);
  const schedulerService = new SchedulerService(eventBus);
  const gameApplicationService = new GameApplicationService(
    gameRepo,
    registrationRepo,
    eventBus,
    gameDomainService,
    schedulerService
  );
  const userApplicationService = new UserApplicationService(userRepo);

  /**
   * Позволяет пользователю присоединиться к игре.
   * @param {string} gameId - Идентификатор игры.
   * @param {string} userId - Идентификатор пользователя.
   * @returns {Promise<{ status: RegStatus }>} - Статус регистрации пользователя.
   * @throws {DomainError} - Если игра не найдена или пользователь не может присоединиться.
   */
  export async function joinGame(gameId: string, userId: string) {
    if (!gameId?.trim()) {
      throw new DomainError('INVALID_INPUT', 'gameId не может быть пустым');
    }
    if (!userId?.trim()) {
      throw new DomainError('INVALID_INPUT', 'userId не может быть пустым');
    }

    const useCaseLogger = LoggerFactory.useCase('joinGame');
    const correlationId = `join_${userId}_${gameId}_${Date.now()}`;

    useCaseLogger.info('joinGame', LOG_MESSAGES.USE_CASES.JOIN_GAME_PROCESSING,
      { gameId, userId },
      { correlationId }
    );

    // Проверить, находится ли игра в приоритетном окне
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { status: true, organizerId: true, startsAt: true, createdAt: true }
    });

    if (!game) {
      throw new DomainError('NOT_FOUND', 'Игра не найдена');
    }

    // Проверить, что игра еще не началась
    // NOTE: Время игры хранится в UTC, сравниваем с текущим временем в UTC
    if (game.startsAt <= new Date()) {
      throw new DomainError('GAME_ALREADY_STARTED', 'Игра уже началась');
    }

    // Если игра создана недавно (в течение последних 2 часов), проверить, является ли пользователь подтвержденным игроком организатора
    // Но только если пользователь не является организатором игры
    const gameAge = Date.now() - game.createdAt.getTime();
    const isInPriorityWindow = game.status === 'open' && gameAge < 2 * 60 * 60 * 1000;

    if (isInPriorityWindow) {
      // Проверить, является ли пользователь организатором игры
      const isOrganizer = game.organizerId === userId;
      if (!isOrganizer) {
        const isConfirmedPlayer = await (prisma as any).playerOrganizer.findFirst({
          where: {
            playerId: userId,
            organizerId: game.organizerId,
            status: 'confirmed'
          }
        });

        if (!isConfirmedPlayer) {
          throw new DomainError('PRIORITY_WINDOW_ACTIVE', 'Игра доступна только для подтвержденных игроков организатора в приоритетное окно');
        }
      }
    }

    // Use new Application Service
    const result = await gameApplicationService.joinGame({ gameId, userId });

    useCaseLogger.info('joinGame', LOG_MESSAGES.USE_CASES.JOIN_GAME_COMPLETED,
      { gameId, userId, status: result.status },
      { correlationId, executionTimeMs: Date.now() - parseInt(correlationId.split('_')[2] || '0') }
    );

    return result;
  }

  /**
   * Позволяет пользователю покинуть игру.
   * @param {string} gameId - Идентификатор игры.
   * @param {string} userId - Идентификатор пользователя.
   * @returns {Promise<{ ok: boolean }>} - Успех операции.
   */
  export async function leaveGame(gameId: string, userId: string) {
    if (!gameId?.trim()) {
      throw new DomainError('INVALID_INPUT', 'gameId не может быть пустым');
    }
    if (!userId?.trim()) {
      throw new DomainError('INVALID_INPUT', 'userId не может быть пустым');
    }

    logger.info('leaveGame called', { gameId, userId });

    return prisma.$transaction(async (tx: any) => {
      const reg = await registrationRepo.get(gameId, userId);
      if (!reg) return { ok: true };
      if (reg.status === RegStatus.canceled) return { ok: true };

      reg.cancel();
      await registrationRepo.upsert(reg);
      logger.info('User left game', { gameId, userId });
      await eventBus.publish({ type: 'RegistrationCanceled', occurredAt: new Date(), id: '', payload: { gameId, userId } });

      // Продвинуть следующего из списка ожидания
      const next = await registrationRepo.firstWaitlisted(gameId);
      if (next) {
        await registrationRepo.promoteToConfirmed(next.id);
        logger.info('Waitlisted user promoted', { gameId, promotedUserId: next.userId });
        await eventBus.publish({ type: 'WaitlistedPromoted', occurredAt: new Date(), id: '', payload: { gameId, userId: next.userId } });
      }

      return { ok: true };
    });
  }

  /**
   * Отмечает оплату для подтвержденного участника.
   * @param {string} gameId - Идентификатор игры.
   * @param {string} userId - Идентификатор пользователя.
   * @returns {Promise<{ ok: boolean }>} - Успех операции.
   * @throws {DomainError} - Если игра не найдена или окно оплаты еще не открыто.
   */
  export async function markPayment(gameId: string, userId: string) {
    if (!gameId?.trim()) {
      throw new DomainError('INVALID_INPUT', 'gameId не может быть пустым');
    }
    if (!userId?.trim()) {
      throw new DomainError('INVALID_INPUT', 'userId не может быть пустым');
    }

    logger.info('markPayment called', { gameId, userId });

    // Use new Application Service
    await gameApplicationService.markPayment({ gameId, userId });

    return { ok: true };
  }

  /**
   * Планирует напоминания для игры.
   * @param {string} gameId - Идентификатор игры.
   * @returns {Promise<void>} - Успех операции.
   */
  export async function scheduleGameReminders(gameId: string) {
    if (!gameId?.trim()) {
      throw new DomainError('INVALID_INPUT', 'gameId не может быть пустым');
    }

    logger.info('scheduleGameReminders called', { gameId });

    const game = await gameRepo.findById(gameId);
    if (!game) throw new DomainError('NOT_FOUND', 'Игра не найдена');

    // Use new SchedulerService
    await schedulerService.scheduleGameReminder24h(gameId, game.startsAt);
    await schedulerService.initializeWorkers(); // Ensure workers are running

    logger.info('Game reminders scheduled', { gameId });
  }

  /**
   * Планирует напоминания об оплате после игры.
   * @param {string} gameId - Идентификатор игры.
   * @returns {Promise<void>} - Успех операции.
   */
  export async function schedulePaymentReminders(gameId: string) {
    if (!gameId?.trim()) {
      throw new DomainError('INVALID_INPUT', 'gameId не может быть пустым');
    }

    logger.info('schedulePaymentReminders called', { gameId });

    const game = await gameRepo.findById(gameId);
    if (!game) throw new DomainError('NOT_FOUND', 'Игра не найдена');

    // Use new SchedulerService
    await schedulerService.schedulePaymentReminder12h(gameId, game.startsAt);
    await schedulerService.schedulePaymentReminder24h(gameId, game.startsAt);

    logger.info('Payment reminders scheduled', { gameId });
  }

  /**
   * Отправляет массовые напоминания об оплате для игры.
   * @param {string} gameId - Идентификатор игры.
   * @param {string} organizerId - ID организатора.
   * @returns {Promise<{ sent: number }>} - Количество отправленных напоминаний.
   */
  export async function sendPaymentReminders(gameId: string, organizerId: string | undefined) {
    if (!gameId?.trim()) {
      throw new DomainError('INVALID_INPUT', 'gameId не может быть пустым');
    }
    if (!organizerId) {
      throw new DomainError('INVALID_INPUT', 'organizerId не может быть пустым');
    }

    logger.info('sendPaymentReminders called', { gameId, organizerId });

    // Проверить, что организатор владеет игрой
    const game = await prisma.game.findUnique({
      where: { id: gameId, organizerId },
      include: {
        registrations: {
          where: { status: 'confirmed', paymentStatus: 'unpaid' },
          include: { user: true }
        }
      }
    });

    if (!game) {
      throw new DomainError('NOT_FOUND', 'Игра не найдена или доступ запрещен');
    }

    // Публикуем событие для массовых напоминаний
    await eventBus.publish({
      type: 'SendPaymentReminders',
      occurredAt: new Date(),
      id: '',
      payload: {
        gameId,
        unpaidRegistrations: game.registrations.map(r => ({
          userId: r.userId,
          telegramId: r.user.telegramId
        }))
      }
    });

    logger.info('Payment reminders sent', { gameId, count: game.registrations.length });

    return { sent: game.registrations.length };
  }

  /**
   * Создает новую игру с заданными параметрами.
   * @param {Object} data - Данные для создания игры.
   * @param {string} data.organizerId - Идентификатор организатора.
   * @param {string} data.venueId - Идентификатор места проведения.
   * @param {Date} data.startsAt - Дата начала игры.
   * @param {number} data.capacity - Вместимость игры.
   * @param {string} [data.levelTag] - Уровень игры (опционально).
   * @param {string} [data.priceText] - Цена игры (опционально).
   * @returns {Promise<Game>} - Созданная игра.
   */
  export async function createGame(data: {
    organizerId: string;
    venueId: string;
    startsAt: Date;
    capacity: number;
    levelTag?: string;
    priceText?: string;
  }) {
    if (!data.organizerId?.trim()) {
      throw new DomainError('INVALID_INPUT', 'organizerId не может быть пустым');
    }
    if (!data.venueId?.trim()) {
      throw new DomainError('INVALID_INPUT', 'venueId не может быть пустым');
    }
    if (!data.startsAt || isNaN(data.startsAt.getTime())) {
      throw new DomainError('INVALID_INPUT', 'startsAt должен быть валидной датой');
    }
    if (data.capacity <= 0 || data.capacity > 100) {
      throw new DomainError('INVALID_INPUT', 'capacity должен быть от 1 до 100');
    }

    logger.info('createGame called', { organizerId: data.organizerId, venueId: data.venueId, capacity: data.capacity });

    // Use new Application Service
    return await gameApplicationService.createGame(data);
  }

  /**
   * Регистрирует пользователя.
   * @param {number | bigint} telegramId - Telegram ID пользователя.
   * @param {string} name - Имя пользователя.
   * @returns {Promise<{ userId: string }>} - ID созданного пользователя.
   */
  export async function registerUser(telegramId: number | bigint, name: string): Promise<{ userId: string; }> {
    if (telegramId <= 0) {
      throw new DomainError('INVALID_INPUT', 'telegramId должен быть положительным числом');
    }
    if (!name?.trim()) {
      throw new DomainError('INVALID_INPUT', 'name не может быть пустым');
    }

    const useCaseLogger = LoggerFactory.useCase('registerUser');
    const correlationId = `register_${telegramId}_${Date.now()}`;

    useCaseLogger.info('registerUser', LOG_MESSAGES.USE_CASES.REGISTER_USER_PROCESSING,
      { telegramId, name },
      { correlationId }
    );

    try {
      const result = await userApplicationService.registerUser({ telegramId, name });

      useCaseLogger.info('registerUser', LOG_MESSAGES.USE_CASES.REGISTER_USER_COMPLETED,
        { userId: result.userId, telegramId },
        { correlationId, executionTimeMs: Date.now() - parseInt(correlationId.split('_')[2] || '0') }
      );

      return result;
    } catch (error) {
      useCaseLogger.error('registerUser', LOG_MESSAGES.USE_CASES.REGISTER_USER_FAILED,
        error as Error,
        { telegramId, name, error: (error as Error).message },
        { correlationId }
      );
      throw error;
    }
  }

  /**
   * Обновляет уровень пользователя.
   * @param {string} userId - ID пользователя.
   * @param {string} levelTag - Уровень игры.
   * @returns {Promise<{ ok: boolean }>} - Успех операции.
   */
  export async function updateUserLevel(userId: string, levelTag: string | undefined) {
    if (!userId?.trim()) {
      throw new DomainError('INVALID_INPUT', 'userId не может быть пустым');
    }

    logger.info('updateUserLevel called', { userId, levelTag });

    // Use new Application Service
    return await userApplicationService.updateUserLevel({ userId, levelTag });
  }

  /**
   * Регистрирует организатора.
   * @param {string} userId - ID пользователя.
   * @param {string} title - Название организатора.
   * @returns {Promise<{ ok: boolean }>} - Успех операции.
   */
  export async function registerOrganizer(userId: string, title: string) {
    if (!userId?.trim()) {
      throw new DomainError('INVALID_INPUT', 'userId не может быть пустым');
    }
    if (!title?.trim()) {
      throw new DomainError('INVALID_INPUT', 'title не может быть пустым');
    }

    logger.info('registerOrganizer called', { userId, title });

    // Use new Application Service
    return await gameApplicationService.registerOrganizer({ userId, title });
  }

  /**
   * Получает список игр.
   * @param {string} [userId] - ID пользователя (опционально, для фильтрации по приоритетному окну).
   * @returns {Promise<Game[]>} - Список игр.
   */
  export async function listGames(userId?: string) {
    const games = await prisma.game.findMany({
      where: { status: 'open' },
      orderBy: { startsAt: 'asc' }
    });

    // Если передан userId, фильтруем игры по приоритетному окну
    let filteredGames = games;
    if (userId) {
      filteredGames = [];
      for (const game of games) {
        const gameAge = Date.now() - game.createdAt.getTime();
        const isInPriorityWindow = game.status === 'open' && gameAge < 2 * 60 * 60 * 1000 && !game.publishedForAll;

        if (!isInPriorityWindow) {
          // Игра не в приоритетном окне или опубликована для всех - показываем всем
          filteredGames.push(game);
        } else {
          // Игра в приоритетном окне - проверяем, является ли пользователь подтвержденным игроком или организатором
          const isOrganizer = game.organizerId === userId;
          if (isOrganizer) {
            filteredGames.push(game);
          } else {
            const isConfirmedPlayer = await (prisma as any).playerOrganizer.findFirst({
              where: {
                playerId: userId,
                organizerId: game.organizerId,
                status: 'confirmed'
              }
            });
            if (isConfirmedPlayer) {
              filteredGames.push(game);
            }
          }
        }
      }
    }

    return filteredGames.map((g: any) => new Game(
      g.id,
      g.organizerId,
      g.venueId,
      g.startsAt,
      g.capacity,
      g.levelTag || undefined,
      g.priceText || undefined,
      g.status
    ));
  }

  /**
   * Закрывает игру.
   * @param {string} gameId - Идентификатор игры.
   * @param {string} organizerId - Идентификатор организатора.
   * @returns {Promise<void>} - Успех операции.
   */
  export async function closeGame(gameId: string, organizerId: string) {
    if (!gameId?.trim()) {
      throw new DomainError('INVALID_INPUT', 'gameId не может быть пустым');
    }
    if (!organizerId?.trim()) {
      throw new DomainError('INVALID_INPUT', 'organizerId не может быть пустым');
    }

    logger.info('closeGame called', { gameId, organizerId });

    // Проверить, что организатор владеет игрой
    const game = await gameRepo.findById(gameId);
    if (!game) {
      throw new DomainError('NOT_FOUND', 'Игра не найдена');
    }
    if (game.organizerId !== organizerId) {
      throw new DomainError('FORBIDDEN', 'Только организатор игры может её закрыть');
    }

    await gameRepo.updateStatus(gameId, GameStatus.closed);
    logger.info('Game closed', { gameId });
    await eventBus.publish({ type: 'GameClosed', occurredAt: new Date(), id: '', payload: { gameId } });
  }

  /**
   * Завершает игру и планирует напоминания об оплате.
   * @param {string} gameId - Идентификатор игры.
   * @returns {Promise<void>} - Успех операции.
   */
  export async function finishGame(gameId: string) {
    if (!gameId?.trim()) {
      throw new DomainError('INVALID_INPUT', 'gameId не может быть пустым');
    }

    logger.info('finishGame called', { gameId });

    // Use new Application Service
    await gameApplicationService.finishGame(gameId);

    logger.info('Game finished and payment reminders scheduled', { gameId });
  }

  /**
   * Позволяет игроку выбрать организаторов.
   * @param {string} playerId - ID игрока.
   * @param {string[]} organizerIds - Массив ID организаторов.
   * @returns {Promise<{ ok: boolean }>} - Успех операции.
   */
  export async function selectOrganizers(playerId: string, organizerIds: string[]) {
    if (!playerId?.trim()) {
      throw new DomainError('INVALID_INPUT', 'playerId не может быть пустым');
    }
    if (!organizerIds?.length) {
      throw new DomainError('INVALID_INPUT', 'organizerIds не может быть пустым');
    }

    logger.info('selectOrganizers called', { playerId, organizerIds });

    // Проверить существование игрока
    const player = await prisma.user.findUnique({ where: { id: playerId } });
    if (!player) throw new DomainError('NOT_FOUND', 'Игрок не найден');

    // Проверить существование организаторов
    const organizers = await prisma.organizer.findMany({
      where: { id: { in: organizerIds } }
    });
    if (organizers.length !== organizerIds.length) {
      throw new DomainError('NOT_FOUND', 'Один или несколько организаторов не найдены');
    }

    // Создать связи со статусом pending
    const playerOrganizers = organizerIds.map(organizerId => ({
      playerId,
      organizerId,
      status: 'pending' as const,
    }));

    await (prisma as any).playerOrganizer.createMany({
      data: playerOrganizers,
      skipDuplicates: true, // Игнорировать дубликаты
    });

    logger.info('Organizers selected', { playerId, organizerIds });
    await eventBus.publish({
      type: 'PlayerSelectedOrganizers',
      occurredAt: new Date(),
      id: '',
      payload: { playerId, organizerIds }
    });

    return { ok: true };
  }

  /**
   * Позволяет организатору подтвердить игрока.
   * @param {string} organizerId - ID организатора.
   * @param {string} playerId - ID игрока.
   * @returns {Promise<{ ok: boolean }>} - Успех операции.
   */
  export async function confirmPlayer(organizerId: string, playerId: string) {
    if (!organizerId?.trim()) {
      throw new DomainError('INVALID_INPUT', 'organizerId не может быть пустым');
    }
    if (!playerId?.trim()) {
      throw new DomainError('INVALID_INPUT', 'playerId не может быть пустым');
    }

    logger.info('confirmPlayer called', { organizerId, playerId });

    // Проверить существование связи со статусом pending
    const playerOrganizer = await (prisma as any).playerOrganizer.findUnique({
      where: { playerId_organizerId: { playerId, organizerId } }
    });
    if (!playerOrganizer) {
      throw new DomainError('NOT_FOUND', 'Связь между игроком и организатором не найдена');
    }
    if (playerOrganizer.status !== 'pending') {
      throw new DomainError('INVALID_STATE', 'Игрок уже подтвержден или отклонен');
    }

    // Обновить статус на confirmed
    await (prisma as any).playerOrganizer.update({
      where: { playerId_organizerId: { playerId, organizerId } },
      data: { status: 'confirmed', confirmedAt: new Date() }
    });

    // Получить имя игрока для события
    const player = await prisma.user.findUnique({
      where: { id: playerId },
      select: { name: true }
    });

    logger.info('Player confirmed', { organizerId, playerId });
    await eventBus.publish({
      type: 'PlayerConfirmedByOrganizer',
      occurredAt: new Date(),
      id: '',
      payload: { organizerId, playerId, playerName: player?.name || 'Unknown' }
    });

    return { ok: true };
  }

  /**
   * Позволяет организатору отклонить игрока.
   * @param {string} organizerId - ID организатора.
   * @param {string} playerId - ID игрока.
   * @returns {Promise<{ ok: boolean }>} - Успех операции.
   */
  export async function rejectPlayer(organizerId: string, playerId: string) {
    if (!organizerId?.trim()) {
      throw new DomainError('INVALID_INPUT', 'organizerId не может быть пустым');
    }
    if (!playerId?.trim()) {
      throw new DomainError('INVALID_INPUT', 'playerId не может быть пустым');
    }

    logger.info('rejectPlayer called', { organizerId, playerId });

    // Обновить статус на rejected
    const result = await (prisma as any).playerOrganizer.updateMany({
      where: {
        playerId,
        organizerId,
        status: 'pending'
      },
      data: { status: 'rejected' }
    });

    if (result.count === 0) {
      throw new DomainError('NOT_FOUND', 'Связь между игроком и организатором не найдена или уже обработана');
    }

    // Получить имя игрока для события
    const player = await prisma.user.findUnique({
      where: { id: playerId },
      select: { name: true }
    });

    logger.info('Player rejected', { organizerId, playerId });
    await eventBus.publish({
      type: 'PlayerRejectedByOrganizer',
      occurredAt: new Date(),
      id: '',
      payload: { organizerId, playerId, playerName: player?.name || 'Unknown' }
    });

    return { ok: true };
  }

  /**
   * Получает список игроков организатора.
   * @param {string} organizerId - ID организатора.
   * @param {string} [status] - Фильтр по статусу (опционально).
   * @returns {Promise<Array>} - Список игроков.
   */
  export async function getOrganizerPlayers(organizerId: string, status?: string) {
    if (!organizerId?.trim()) {
      throw new DomainError('INVALID_INPUT', 'organizerId не может быть пустым');
    }

    logger.info('getOrganizerPlayers called', { organizerId, status });

    const where: any = { organizerId };
    if (status) {
      where.status = status;
    }

    const playerOrganizers = await (prisma as any).playerOrganizer.findMany({
      where,
      include: {
        player: {
          select: { id: true, name: true, levelTag: true }
        }
      },
      orderBy: { requestedAt: 'desc' }
    });

    return playerOrganizers.map((po: any) => ({
      playerId: po.player.id,
      playerName: po.player.name,
      levelTag: po.player.levelTag,
      status: po.status,
      requestedAt: po.requestedAt,
      confirmedAt: po.confirmedAt
    }));
  }

   /**
    * Проверяет, все ли приоритетные игроки ответили на приглашение.
    * Если все ответили — публикует GamePublishedForAll.
    * @param {string} gameId - ID игры.
    */
   async function checkIfAllPriorityPlayersResponded(gameId: string): Promise<void> {
     const game = await prisma.game.findUnique({
       where: { id: gameId },
       select: { organizerId: true }
     });

     if (!game) {
       logger.warn('Game not found for priority check', { gameId });
       return;
     }

     // Получить всех подтвержденных игроков организатора
     const confirmedPlayers = await (prisma as any).playerOrganizer.findMany({
       where: {
         organizerId: game.organizerId,
         status: 'confirmed'
       },
       select: { playerId: true }
     });

     if (confirmedPlayers.length === 0) {
       // Нет приоритетных игроков — сразу открываем для всех
       logger.info('No priority players for game, publishing for all', { gameId });
       await eventBus.publish({
         type: 'GamePublishedForAll',
         occurredAt: new Date(),
         id: '',
         payload: { gameId }
       });
       return;
     }

     // Получить ответы всех приоритетных игроков
     const responses = await (prisma as any).gamePlayerResponse.findMany({
       where: {
         gameId,
         playerId: { in: confirmedPlayers.map((p: any) => p.playerId) }
       },
       select: { response: true }
     });

     // Проверить, все ли ответили (не 'ignored')
     const allResponded = responses.length === confirmedPlayers.length &&
       responses.every((r: any) => r.response !== 'ignored');

     if (allResponded) {
       logger.info('All priority players responded, publishing game for all', { gameId, playerCount: confirmedPlayers.length });
       await eventBus.publish({
         type: 'GamePublishedForAll',
         occurredAt: new Date(),
         id: '',
         payload: { gameId }
       });
     } else {
       logger.info('Not all priority players responded yet', {
         gameId,
         responded: responses.length,
         total: confirmedPlayers.length
       });
     }
   }

  /**
   * Позволяет игроку ответить на приглашение к игре.
   * @param {string} gameId - ID игры.
   * @param {string} playerId - ID игрока.
   * @param {string} response - Ответ ('yes', 'no', 'ignored').
   * @returns {Promise<{ ok: boolean }>} - Успех операции.
   */
  export async function respondToGameInvitation(gameId: string, playerId: string, response: string) {
    if (!gameId?.trim()) {
      throw new DomainError('INVALID_INPUT', 'gameId не может быть пустым');
    }
    if (!playerId?.trim()) {
      throw new DomainError('INVALID_INPUT', 'playerId не может быть пустым');
    }
    if (!['yes', 'no', 'ignored'].includes(response)) {
      throw new DomainError('INVALID_INPUT', 'response должен быть "yes", "no" или "ignored"');
    }

    logger.info('respondToGameInvitation called', { gameId, playerId, response });

    // Проверить, что игрок — подтвержденный игрок организатора игры
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { organizerId: true, createdAt: true }
    });
    if (!game) {
      throw new DomainError('NOT_FOUND', 'Игра не найдена');
    }

    const isConfirmedPlayer = await (prisma as any).playerOrganizer.findFirst({
      where: {
        playerId,
        organizerId: game.organizerId,
        status: 'confirmed'
      }
    });

    if (!isConfirmedPlayer) {
      throw new DomainError('FORBIDDEN', 'Только подтвержденные игроки организатора могут отвечать на приглашения');
    }

    // Обновить или создать запись GamePlayerResponse
    await (prisma as any).gamePlayerResponse.upsert({
      where: {
        gameId_playerId: { gameId, playerId }
      },
      update: {
        response: response as any,
        respondedAt: response !== 'ignored' ? new Date() : null
      },
      create: {
        gameId,
        playerId,
        response: response as any,
        respondedAt: response !== 'ignored' ? new Date() : null
      }
    });

    logger.info('Player responded to game invitation', { gameId, playerId, response });
    await eventBus.publish({
      type: 'PlayerRespondedToGameInvitation',
      occurredAt: new Date(),
      id: '',
      payload: { gameId, playerId, response }
    });

    // Проверить, все ли приоритетные игроки ответили
    await checkIfAllPriorityPlayersResponded(gameId);

    return { ok: true };
  }

  /**
   * Уведомляет подтвержденных игроков о новой игре.
   * @param {string} gameId - ID игры.
   * @returns {Promise<void>} - Успех операции.
   */
  export async function notifyConfirmedPlayersAboutGame(gameId: string) {
    if (!gameId?.trim()) {
      throw new DomainError('INVALID_INPUT', 'gameId не может быть пустым');
    }

    logger.info('notifyConfirmedPlayersAboutGame called', { gameId });

    // Найти игру и организатора
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: { organizer: true }
    });
    if (!game) {
      throw new DomainError('NOT_FOUND', 'Игра не найдена');
    }

    // Найти всех подтвержденных игроков организатора
    const confirmedPlayers = await (prisma as any).playerOrganizer.findMany({
      where: {
        organizerId: game.organizer.id,
        status: 'confirmed'
      },
      include: {
        player: true
      }
    });

    // Создать записи GamePlayerResponse со статусом 'ignored' (ожидание ответа)
    const responses = confirmedPlayers.map((po: any) => ({
      gameId,
      playerId: po.player.id,
      response: 'ignored' as const
    }));

    await (prisma as any).gamePlayerResponse.createMany({
      data: responses,
      skipDuplicates: true
    });

    // Опубликовать событие для уведомления игроков
    const priorityWindowClosesAt = new Date(game.createdAt.getTime() + 2 * 60 * 60 * 1000);
    await eventBus.publish({
      type: 'GameCreatedWithPriorityWindow',
      occurredAt: new Date(),
      id: '',
      payload: {
        gameId,
        priorityWindowClosesAt: priorityWindowClosesAt.toISOString(),
        confirmedPlayers: confirmedPlayers.map((po: any) => ({
          playerId: po.player.id,
          telegramId: po.player.telegramId
        }))
      }
    });

    logger.info('Confirmed players notified about game', { gameId, playerCount: confirmedPlayers.length });
  }

  /**
   * Проверяет истечение приоритетного окна и публикует игру для всех.
   * Вызывается по таймеру через 2 часа после создания игры.
   * @param {string} gameId - ID игры.
   * @returns {Promise<void>} - Успех операции.
   */
  export async function checkPriorityWindowExpiration(gameId: string) {
    if (!gameId?.trim()) {
      throw new DomainError('INVALID_INPUT', 'gameId не может быть пустым');
    }

    logger.info('checkPriorityWindowExpiration called', { gameId });

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { status: true, createdAt: true }
    });

    if (!game || game.status !== 'open') {
      logger.info('Game not found or not open', { gameId });
      return;
    }

    // Проверить, истекло ли приоритетное окно (2 часа после создания)
    const priorityWindowClosesAt = new Date(game.createdAt.getTime() + 2 * 60 * 60 * 1000);
    if (priorityWindowClosesAt > new Date()) {
      logger.info('Priority window not expired yet', { gameId, closesAt: priorityWindowClosesAt });
      return;
    }

    // Приоритетное окно истекло — публикуем игру для всех
    logger.info('Priority window expired, publishing game for all players', { gameId });
    await eventBus.publish({
      type: 'GamePublishedForAll',
      occurredAt: new Date(),
      id: '',
      payload: { gameId }
    });
  }

  /**
   * Привязывает игрока к организатору и уведомляет организатора.
   * @param {string} playerId - ID игрока.
   * @param {string} organizerId - ID организатора.
   * @returns {Promise<{ ok: boolean }>} - Успех операции.
   */
  export async function linkPlayerToOrganizer(playerId: string, organizerId: string) {
    if (!playerId?.trim()) {
      throw new DomainError('INVALID_INPUT', 'playerId не может быть пустым');
    }
    if (!organizerId?.trim()) {
      throw new DomainError('INVALID_INPUT', 'organizerId не может быть пустым');
    }

    logger.info('linkPlayerToOrganizer called', { playerId, organizerId });

    // Проверить существование игрока и организатора
    const player = await prisma.user.findUnique({ where: { id: playerId } });
    if (!player) throw new DomainError('NOT_FOUND', 'Игрок не найден');

    const organizer = await prisma.organizer.findUnique({ where: { id: organizerId } });
    if (!organizer) throw new DomainError('NOT_FOUND', 'Организатор не найден');

    // Здесь можно добавить логику создания связи, если нужна таблица
    // Пока просто публикуем событие для уведомления
    logger.info('Player linked to organizer', { playerId, organizerId, playerName: player.name });
    await eventBus.publish({
      type: 'PlayerLinkedToOrganizer',
      occurredAt: new Date(),
      id: '',
      payload: {
        playerId,
        organizerId,
        playerName: player.name
      }
    });

    return { ok: true };
  }