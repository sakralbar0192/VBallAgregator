  import { Game, GameStatus } from '../domain/game.js';
  import { RegStatus } from '../domain/registration.js';
  import type { GameRepo, RegistrationRepo } from '../infrastructure/repositories.js';
  import { PrismaGameRepo, PrismaRegistrationRepo } from '../infrastructure/repositories.js';
  import { eventPublisher, evt } from '../shared/event-publisher.js';
  import { logger } from '../shared/logger.js';
  import { DomainError } from '../domain/errors.js';
  import { prisma } from '../infrastructure/prisma.js';
  import { GameApplicationService } from './services/game-service.js';
  import { EventBus } from '../shared/event-bus.js';
  import { GameDomainService } from '../domain/services/game-domain-service.js';
  import { SchedulerService } from '../shared/scheduler-service.js';

  const gameRepo: GameRepo = new PrismaGameRepo();
  const registrationRepo: RegistrationRepo = new PrismaRegistrationRepo();

  // Initialize new services
  const eventBus = new EventBus();
  const gameDomainService = new GameDomainService(gameRepo, registrationRepo);
  const schedulerService = new SchedulerService(eventBus);
  const gameApplicationService = new GameApplicationService(
    gameRepo,
    registrationRepo,
    eventBus,
    gameDomainService,
    schedulerService
  );

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

    logger.info('joinGame called', { gameId, userId });

    // Use new Application Service
    return await gameApplicationService.joinGame({ gameId, userId });
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
      await eventPublisher.publish(evt('RegistrationCanceled', { gameId, userId }));

      // Продвинуть следующего из списка ожидания
      const next = await registrationRepo.firstWaitlisted(gameId);
      if (next) {
        await registrationRepo.promoteToConfirmed(next.id);
        logger.info('Waitlisted user promoted', { gameId, promotedUserId: next.userId });
        await eventPublisher.publish(evt('WaitlistedPromoted', { gameId, userId: next.userId }));
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
    await eventPublisher.publish(evt('SendPaymentReminders', {
      gameId,
      unpaidRegistrations: game.registrations.map(r => ({
        userId: r.userId,
        telegramId: r.user.telegramId
      }))
    }));

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
  export async function registerUser(telegramId: number | bigint, name: string) {
    if (telegramId <= 0) {
      throw new DomainError('INVALID_INPUT', 'telegramId должен быть положительным числом');
    }
    if (!name?.trim()) {
      throw new DomainError('INVALID_INPUT', 'name не может быть пустым');
    }

    logger.info('registerUser called', { telegramId, name });

    // Use new Application Service
    return await gameApplicationService.registerUser({ telegramId, name });
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
    return await gameApplicationService.updateUserLevel({ userId, levelTag });
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
   * @returns {Promise<Game[]>} - Список игр.
   */
  export async function listGames() {
    const games = await prisma.game.findMany({
      where: { status: 'open' },
      orderBy: { startsAt: 'asc' }
    });

    return games.map((g: any) => new Game(
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
   * @returns {Promise<void>} - Успех операции.
   */
  export async function closeGame(gameId: string) {
    if (!gameId?.trim()) {
      throw new DomainError('INVALID_INPUT', 'gameId не может быть пустым');
    }

    logger.info('closeGame called', { gameId });

    await gameRepo.updateStatus(gameId, GameStatus.closed);
    logger.info('Game closed', { gameId });
    await eventPublisher.publish(evt('GameClosed', { gameId }));
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
    await eventPublisher.publish(evt('PlayerLinkedToOrganizer', {
      playerId,
      organizerId,
      playerName: player.name
    }));

    return { ok: true };
  }