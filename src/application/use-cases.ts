  import { Game, GameStatus } from '../domain/game.js';
  import { RegStatus } from '../domain/registration.js';
  import type { GameRepo, RegistrationRepo } from '../infrastructure/repositories/index.js';
  import { PrismaGameRepo, PrismaRegistrationRepo, PrismaUserRepo, PrismaOrganizerRepo } from '../infrastructure/repositories/index.js';
  import { LoggerFactory } from '../shared/layer-logger.js';
  import { LOG_MESSAGES } from '../shared/logging-messages.js';
  import { DomainError } from '../domain/errors.js';
  import { InputValidator } from '../shared/input-validator.js';
  import { ValidationError } from '../domain/errors/validation-error.js';
  import { GameAlreadyStartedError } from '../domain/errors/game-errors.js';
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
  const organizerRepo = new PrismaOrganizerRepo();
  const gameApplicationService = new GameApplicationService(
    gameRepo,
    registrationRepo,
    organizerRepo,
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
     // Валидация входных данных
     InputValidator.validateRequired(gameId, 'gameId');
     InputValidator.validateRequired(userId, 'userId');

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
      throw new GameAlreadyStartedError(gameId, game.startsAt);
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
    // Валидация входных данных
    InputValidator.validateRequired(gameId, 'gameId');
    InputValidator.validateRequired(userId, 'userId');

    const useCaseLogger = LoggerFactory.useCase('leaveGame');
    const correlationId = `leave_${userId}_${gameId}_${Date.now()}`;

    useCaseLogger.info('leaveGame', 'Обработка запроса на выход из игры',
      { gameId, userId },
      { correlationId }
    );

    return prisma.$transaction(async (tx: any) => {
      const reg = await registrationRepo.get(gameId, userId);
      if (!reg) return { ok: true };
      if (reg.status === RegStatus.canceled) return { ok: true };

      reg.cancel();
      await registrationRepo.upsert(reg);
      useCaseLogger.info('leaveGame', 'Пользователь вышел из игры',
        { gameId, userId },
        { correlationId }
      );
      await eventBus.publish({ type: 'RegistrationCanceled', occurredAt: new Date(), id: '', payload: { gameId, userId } });

      // Продвинуть следующего из списка ожидания
      const next = await registrationRepo.firstWaitlisted(gameId);
      if (next) {
        await registrationRepo.promoteToConfirmed(next.id);
        useCaseLogger.info('leaveGame', 'Пользователь из списка ожидания повышен до подтвержденного',
          { gameId, promotedUserId: next.userId },
          { correlationId }
        );
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
    // Валидация входных данных
    InputValidator.validateRequired(gameId, 'gameId');
    InputValidator.validateRequired(userId, 'userId');

    const useCaseLogger = LoggerFactory.useCase('markPayment');
    const correlationId = `mark_payment_${userId}_${gameId}_${Date.now()}`;

    useCaseLogger.info('markPayment', 'Обработка запроса на отметку оплаты',
      { gameId, userId },
      { correlationId }
    );

    // Use new Application Service
    await gameApplicationService.markPayment({ gameId, userId });

    useCaseLogger.info('markPayment', 'Оплата отмечена успешно',
      { gameId, userId },
      { correlationId, executionTimeMs: Date.now() - parseInt(correlationId.split('_')[3] || '0') }
    );

    return { ok: true };
  }

  /**
   * Планирует напоминания для игры.
   * @param {string} gameId - Идентификатор игры.
   * @returns {Promise<void>} - Успех операции.
   */
  export async function scheduleGameReminders(gameId: string) {
    // Валидация входных данных
    InputValidator.validateRequired(gameId, 'gameId');

    const useCaseLogger = LoggerFactory.useCase('scheduleGameReminders');
    const correlationId = `schedule_reminders_${gameId}_${Date.now()}`;

    useCaseLogger.info('scheduleGameReminders', 'Обработка запроса на планирование напоминаний игры',
      { gameId },
      { correlationId }
    );

    const game = await gameRepo.findById(gameId);
    if (!game) throw new DomainError('NOT_FOUND', 'Игра не найдена');

    // Use new SchedulerService
    await schedulerService.scheduleGameReminder24h(gameId, game.startsAt);
    await schedulerService.initializeWorkers(); // Ensure workers are running

    useCaseLogger.info('scheduleGameReminders', 'Напоминания игры запланированы',
      { gameId },
      { correlationId, executionTimeMs: Date.now() - parseInt(correlationId.split('_')[2] || '0') }
    );
  }

  /**
   * Планирует напоминания об оплате после игры.
   * @param {string} gameId - Идентификатор игры.
   * @returns {Promise<void>} - Успех операции.
   */
  export async function schedulePaymentReminders(gameId: string) {
    // Валидация входных данных
    InputValidator.validateRequired(gameId, 'gameId');

    const useCaseLogger = LoggerFactory.useCase('schedulePaymentReminders');
    const correlationId = `schedule_payment_reminders_${gameId}_${Date.now()}`;

    useCaseLogger.info('schedulePaymentReminders', 'Обработка запроса на планирование напоминаний оплаты',
      { gameId },
      { correlationId }
    );

    const game = await gameRepo.findById(gameId);
    if (!game) throw new DomainError('NOT_FOUND', 'Игра не найдена');

    // Use new SchedulerService
    await schedulerService.schedulePaymentReminder12h(gameId, game.startsAt);
    await schedulerService.schedulePaymentReminder24h(gameId, game.startsAt);

    useCaseLogger.info('schedulePaymentReminders', 'Напоминания оплаты запланированы',
      { gameId },
      { correlationId, executionTimeMs: Date.now() - parseInt(correlationId.split('_')[3] || '0') }
    );
  }

  /**
   * Отправляет массовые напоминания об оплате для игры.
   * @param {string} gameId - Идентификатор игры.
   * @param {string} organizerId - ID организатора.
   * @returns {Promise<{ sent: number }>} - Количество отправленных напоминаний.
   */
  export async function sendPaymentReminders(gameId: string, organizerId: string | undefined) {
    // Валидация входных данных
    InputValidator.validateRequired(gameId, 'gameId');
    InputValidator.validateRequired(organizerId, 'organizerId');

    const useCaseLogger = LoggerFactory.useCase('sendPaymentReminders');
    const correlationId = `send_payment_reminders_${gameId}_${organizerId}_${Date.now()}`;

    useCaseLogger.info('sendPaymentReminders', 'Обработка запроса на отправку напоминаний оплаты',
      { gameId, organizerId },
      { correlationId }
    );

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

    useCaseLogger.info('sendPaymentReminders', 'Напоминания оплаты отправлены',
      { gameId, count: game.registrations.length },
      { correlationId, executionTimeMs: Date.now() - parseInt(correlationId.split('_')[3] || '0') }
    );

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
    // Валидация входных данных
    InputValidator.validateRequired(data.organizerId, 'organizerId');
    InputValidator.validateRequired(data.venueId, 'venueId');
    InputValidator.validateDate(data.startsAt, 'startsAt');
    InputValidator.validatePositiveNumber(data.capacity, 'capacity');
    if (data.capacity > 100) {
      throw new ValidationError('capacity', data.capacity, 'max_100');
    }

    const useCaseLogger = LoggerFactory.useCase('createGame');
    const correlationId = `create_game_${data.organizerId}_${Date.now()}`;

    useCaseLogger.info('createGame', 'Обработка запроса на создание игры',
      { organizerId: data.organizerId, venueId: data.venueId, capacity: data.capacity },
      { correlationId }
    );

    // Use new Application Service
    const result = await gameApplicationService.createGame(data);

    useCaseLogger.info('createGame', 'Игра создана успешно',
      { gameId: result.id, organizerId: data.organizerId },
      { correlationId, executionTimeMs: Date.now() - parseInt(correlationId.split('_')[2] || '0') }
    );

    return result;
  }

  /**
   * Регистрирует пользователя.
   * @param {number | bigint} telegramId - Telegram ID пользователя.
   * @param {string} name - Имя пользователя.
   * @returns {Promise<{ userId: string }>} - ID созданного пользователя.
   */
  export async function registerUser(telegramId: number | bigint, name: string): Promise<{ userId: string; }> {
    // Валидация входных данных
    InputValidator.validatePositiveNumber(Number(telegramId), 'telegramId');
    InputValidator.validateRequired(name, 'name');
    InputValidator.validateStringLength(name, 'name', 1, 100);

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
  export async function updateUserLevel(userId: string, levelTag: string | undefined): Promise<{ ok: boolean; }> {
    // Валидация входных данных
    InputValidator.validateRequired(userId, 'userId');

    const useCaseLogger = LoggerFactory.useCase('updateUserLevel');
    const correlationId = `update_level_${userId}_${Date.now()}`;

    useCaseLogger.info('updateUserLevel', 'Обработка запроса на обновление уровня пользователя',
      { userId, levelTag },
      { correlationId }
    );

    const result = await userApplicationService.updateUserLevel({ userId, levelTag });

    useCaseLogger.info('updateUserLevel', 'Уровень пользователя обновлен',
      { userId, levelTag },
      { correlationId, executionTimeMs: Date.now() - parseInt(correlationId.split('_')[2] || '0') }
    );

    return result;
  }

  /**
   * Регистрирует организатора.
   * @param {string} userId - ID пользователя.
   * @param {string} title - Название организатора.
   * @returns {Promise<{ ok: boolean }>} - Успех операции.
   */
  export async function registerOrganizer(userId: string, title: string): Promise<{ ok: boolean; }> {
    // Валидация входных данных
    InputValidator.validateRequired(userId, 'userId');
    InputValidator.validateRequired(title, 'title');
    InputValidator.validateStringLength(title, 'title', 1, 100);

    const useCaseLogger = LoggerFactory.useCase('registerOrganizer');
    const correlationId = `register_org_${userId}_${Date.now()}`;

    useCaseLogger.info('registerOrganizer', LOG_MESSAGES.USE_CASES.REGISTER_ORGANIZER_PROCESSING,
      { userId, title },
      { correlationId }
    );

    try {
      const result = await gameApplicationService.registerOrganizer({ userId, title });

      useCaseLogger.info('registerOrganizer', LOG_MESSAGES.USE_CASES.REGISTER_ORGANIZER_COMPLETED,
        { userId, title },
        { correlationId, executionTimeMs: Date.now() - parseInt(correlationId.split('_')[2] || '0') }
      );

      return result;
    } catch (error) {
      useCaseLogger.error('registerOrganizer', LOG_MESSAGES.USE_CASES.REGISTER_ORGANIZER_FAILED,
        error as Error,
        { userId, title, error: (error as Error).message },
        { correlationId }
      );
      throw error;
    }
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
    // Валидация входных данных
    InputValidator.validateRequired(gameId, 'gameId');
    InputValidator.validateRequired(organizerId, 'organizerId');

    const useCaseLogger = LoggerFactory.useCase('closeGame');
    const correlationId = `close_game_${gameId}_${organizerId}_${Date.now()}`;

    useCaseLogger.info('closeGame', 'Обработка запроса на закрытие игры',
      { gameId, organizerId },
      { correlationId }
    );

    // Проверить, что организатор владеет игрой
    const game = await gameRepo.findById(gameId);
    if (!game) {
      throw new DomainError('NOT_FOUND', 'Игра не найдена');
    }
    if (game.organizerId !== organizerId) {
      throw new DomainError('FORBIDDEN', 'Только организатор игры может её закрыть');
    }

    await gameRepo.updateStatus(gameId, GameStatus.closed);
    useCaseLogger.info('closeGame', 'Игра закрыта',
      { gameId },
      { correlationId, executionTimeMs: Date.now() - parseInt(correlationId.split('_')[3] || '0') }
    );
    await eventBus.publish({ type: 'GameClosed', occurredAt: new Date(), id: '', payload: { gameId } });
  }

  /**
   * Завершает игру и планирует напоминания об оплате.
   * @param {string} gameId - Идентификатор игры.
   * @returns {Promise<void>} - Успех операции.
   */
  export async function finishGame(gameId: string) {
    // Валидация входных данных
    InputValidator.validateRequired(gameId, 'gameId');

    const useCaseLogger = LoggerFactory.useCase('finishGame');
    const correlationId = `finish_game_${gameId}_${Date.now()}`;

    useCaseLogger.info('finishGame', 'Обработка запроса на завершение игры',
      { gameId },
      { correlationId }
    );

    // Use new Application Service
    await gameApplicationService.finishGame(gameId);

    useCaseLogger.info('finishGame', 'Игра завершена и напоминания оплаты запланированы',
      { gameId },
      { correlationId, executionTimeMs: Date.now() - parseInt(correlationId.split('_')[2] || '0') }
    );
  }

  /**
   * Позволяет игроку выбрать организаторов.
   * @param {string} playerId - ID игрока.
   * @param {string[]} organizerIds - Массив ID организаторов.
   * @returns {Promise<{ ok: boolean }>} - Успех операции.
   */
  export async function selectOrganizers(playerId: string, organizerIds: string[]) {
    // Валидация входных данных
    InputValidator.validateRequired(playerId, 'playerId');
    if (!organizerIds?.length) {
      throw new ValidationError('organizerIds', organizerIds, 'not_empty_array');
    }

    const useCaseLogger = LoggerFactory.useCase('selectOrganizers');
    const correlationId = `select_orgs_${playerId}_${Date.now()}`;

    useCaseLogger.info('selectOrganizers', 'Обработка запроса на выбор организаторов',
      { playerId, organizerIds },
      { correlationId }
    );

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

    useCaseLogger.info('selectOrganizers', 'Организаторы выбраны',
      { playerId, organizerIds },
      { correlationId, executionTimeMs: Date.now() - parseInt(correlationId.split('_')[2] || '0') }
    );
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
    // Валидация входных данных
    InputValidator.validateRequired(organizerId, 'organizerId');
    InputValidator.validateRequired(playerId, 'playerId');

    const useCaseLogger = LoggerFactory.useCase('confirmPlayer');
    const correlationId = `confirm_player_${organizerId}_${playerId}_${Date.now()}`;

    useCaseLogger.info('confirmPlayer', 'Обработка запроса на подтверждение игрока',
      { organizerId, playerId },
      { correlationId }
    );

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

    useCaseLogger.info('confirmPlayer', 'Игрок подтвержден',
      { organizerId, playerId },
      { correlationId, executionTimeMs: Date.now() - parseInt(correlationId.split('_')[3] || '0') }
    );
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
    // Валидация входных данных
    InputValidator.validateRequired(organizerId, 'organizerId');
    InputValidator.validateRequired(playerId, 'playerId');

    const useCaseLogger = LoggerFactory.useCase('rejectPlayer');
    const correlationId = `reject_player_${organizerId}_${playerId}_${Date.now()}`;

    useCaseLogger.info('rejectPlayer', 'Обработка запроса на отклонение игрока',
      { organizerId, playerId },
      { correlationId }
    );

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

    useCaseLogger.info('rejectPlayer', 'Игрок отклонен',
      { organizerId, playerId },
      { correlationId, executionTimeMs: Date.now() - parseInt(correlationId.split('_')[3] || '0') }
    );
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
    // Валидация входных данных
    InputValidator.validateRequired(organizerId, 'organizerId');

    const useCaseLogger = LoggerFactory.useCase('getOrganizerPlayers');
    const correlationId = `get_org_players_${organizerId}_${Date.now()}`;

    useCaseLogger.info('getOrganizerPlayers', 'Обработка запроса на получение игроков организатора',
      { organizerId, status },
      { correlationId }
    );

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

    useCaseLogger.info('getOrganizerPlayers', 'Игроки организатора получены',
      { organizerId, count: playerOrganizers.length },
      { correlationId, executionTimeMs: Date.now() - parseInt(correlationId.split('_')[2] || '0') }
    );

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
     const useCaseLogger = LoggerFactory.useCase('checkIfAllPriorityPlayersResponded');
     const correlationId = `check_priority_${gameId}_${Date.now()}`;

     const game = await prisma.game.findUnique({
       where: { id: gameId },
       select: { organizerId: true }
     });

     if (!game) {
       useCaseLogger.warn('checkIfAllPriorityPlayersResponded', 'Игра не найдена для проверки приоритета',
         { gameId },
         { correlationId }
       );
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
       useCaseLogger.info('checkIfAllPriorityPlayersResponded', 'Нет приоритетных игроков для игры, открываем для всех',
         { gameId },
         { correlationId }
       );
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
       useCaseLogger.info('checkIfAllPriorityPlayersResponded', 'Все приоритетные игроки ответили, открываем игру для всех',
         { gameId, playerCount: confirmedPlayers.length },
         { correlationId }
       );
       await eventBus.publish({
         type: 'GamePublishedForAll',
         occurredAt: new Date(),
         id: '',
         payload: { gameId }
       });
     } else {
       useCaseLogger.info('checkIfAllPriorityPlayersResponded', 'Не все приоритетные игроки ответили',
         {
           gameId,
           responded: responses.length,
           total: confirmedPlayers.length
         },
         { correlationId }
       );
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
    // Валидация входных данных
    InputValidator.validateRequired(gameId, 'gameId');
    InputValidator.validateRequired(playerId, 'playerId');
    InputValidator.validateEnum(response, 'response', ['yes', 'no', 'ignored']);

    const useCaseLogger = LoggerFactory.useCase('respondToGameInvitation');
    const correlationId = `respond_invitation_${gameId}_${playerId}_${Date.now()}`;

    useCaseLogger.info('respondToGameInvitation', 'Обработка ответа на приглашение к игре',
      { gameId, playerId, response },
      { correlationId }
    );

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

    useCaseLogger.info('respondToGameInvitation', 'Игрок ответил на приглашение к игре',
      { gameId, playerId, response },
      { correlationId, executionTimeMs: Date.now() - parseInt(correlationId.split('_')[3] || '0') }
    );
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
    // Валидация входных данных
    InputValidator.validateRequired(gameId, 'gameId');

    const useCaseLogger = LoggerFactory.useCase('notifyConfirmedPlayersAboutGame');
    const correlationId = `notify_players_${gameId}_${Date.now()}`;

    useCaseLogger.info('notifyConfirmedPlayersAboutGame', 'Обработка уведомления подтвержденных игроков о игре',
      { gameId },
      { correlationId }
    );

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

    useCaseLogger.info('notifyConfirmedPlayersAboutGame', 'Подтвержденные игроки уведомлены о игре',
      { gameId, playerCount: confirmedPlayers.length },
      { correlationId, executionTimeMs: Date.now() - parseInt(correlationId.split('_')[2] || '0') }
    );
  }

  /**
   * Проверяет истечение приоритетного окна и публикует игру для всех.
   * Вызывается по таймеру через 2 часа после создания игры.
   * @param {string} gameId - ID игры.
   * @returns {Promise<void>} - Успех операции.
   */
  export async function checkPriorityWindowExpiration(gameId: string) {
    // Валидация входных данных
    InputValidator.validateRequired(gameId, 'gameId');

    const useCaseLogger = LoggerFactory.useCase('checkPriorityWindowExpiration');
    const correlationId = `check_expiration_${gameId}_${Date.now()}`;

    useCaseLogger.info('checkPriorityWindowExpiration', 'Обработка проверки истечения приоритетного окна',
      { gameId },
      { correlationId }
    );

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { status: true, createdAt: true }
    });

    if (!game || game.status !== 'open') {
      useCaseLogger.info('checkPriorityWindowExpiration', 'Игра не найдена или не открыта',
        { gameId },
        { correlationId }
      );
      return;
    }

    // Проверить, истекло ли приоритетное окно (2 часа после создания)
    const priorityWindowClosesAt = new Date(game.createdAt.getTime() + 2 * 60 * 60 * 1000);
    if (priorityWindowClosesAt > new Date()) {
      useCaseLogger.info('checkPriorityWindowExpiration', 'Приоритетное окно еще не истекло',
        { gameId, closesAt: priorityWindowClosesAt },
        { correlationId }
      );
      return;
    }

    // Приоритетное окно истекло — публикуем игру для всех
    useCaseLogger.info('checkPriorityWindowExpiration', 'Приоритетное окно истекло, открываем игру для всех игроков',
      { gameId },
      { correlationId, executionTimeMs: Date.now() - parseInt(correlationId.split('_')[2] || '0') }
    );
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
    // Валидация входных данных
    InputValidator.validateRequired(playerId, 'playerId');
    InputValidator.validateRequired(organizerId, 'organizerId');

    const useCaseLogger = LoggerFactory.useCase('linkPlayerToOrganizer');
    const correlationId = `link_player_${playerId}_${organizerId}_${Date.now()}`;

    useCaseLogger.info('linkPlayerToOrganizer', 'Обработка привязки игрока к организатору',
      { playerId, organizerId },
      { correlationId }
    );

    // Проверить существование игрока и организатора
    const player = await prisma.user.findUnique({ where: { id: playerId } });
    if (!player) throw new DomainError('NOT_FOUND', 'Игрок не найден');

    const organizer = await prisma.organizer.findUnique({ where: { id: organizerId } });
    if (!organizer) throw new DomainError('NOT_FOUND', 'Организатор не найден');

    // Здесь можно добавить логику создания связи, если нужна таблица
    // Пока просто публикуем событие для уведомления
    useCaseLogger.info('linkPlayerToOrganizer', 'Игрок привязан к организатору',
      { playerId, organizerId, playerName: player.name },
      { correlationId, executionTimeMs: Date.now() - parseInt(correlationId.split('_')[3] || '0') }
    );
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