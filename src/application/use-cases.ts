  import { v4 as uuid } from 'uuid';
  import { Game, GameStatus } from '../domain/game.js';
  import { Registration, RegStatus } from '../domain/registration.js';
  import type { GameRepo, RegistrationRepo } from '../infrastructure/repositories.js';
  import { PrismaGameRepo, PrismaRegistrationRepo } from '../infrastructure/repositories.js';
  import { eventPublisher, evt } from '../shared/event-publisher.js';
  import { logger } from '../shared/logger.js';
  import { DomainError } from '../domain/errors.js';
  import { prisma } from '../infrastructure/prisma.js';

  const gameRepo: GameRepo = new PrismaGameRepo();
  const registrationRepo: RegistrationRepo = new PrismaRegistrationRepo();

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

    return prisma.$transaction(async (tx: any) => {
      // Advisory lock для предотвращения race conditions
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${gameId}))`;

      const game = await gameRepo.findById(gameId);
      if (!game) throw new DomainError('NOT_FOUND', 'Игра не найдена');

      const confirmedCount = await gameRepo.countConfirmed(gameId);
      const existing = await registrationRepo.get(gameId, userId);

      // Если уже зарегистрирован, вернуть текущий статус
      if (existing) {
        logger.info('User already registered', { gameId, userId, status: existing.status });
        return { status: existing.status };
      }

      // Определить статус на основе текущего количества подтвержденных
      const status = confirmedCount < game.capacity ? RegStatus.confirmed : RegStatus.waitlisted;

      // Проверить правила игры - только если пытается присоединиться как подтвержденный
      if (status === RegStatus.confirmed) {
        game.ensureCanJoin(confirmedCount);
      }

      // Создать новую регистрацию
      const reg = new Registration(uuid(), gameId, userId, status);
      await registrationRepo.upsert(reg);

      logger.info('User joined game', { gameId, userId, status });
      await eventPublisher.publish(evt('PlayerJoined', { gameId, userId, status }));

      return { status };
    });
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

    const game = await gameRepo.findById(gameId);
    if (!game) throw new DomainError('NOT_FOUND', 'Игра не найдена');

    const reg = await registrationRepo.get(gameId, userId);
    if (!reg || reg.status !== RegStatus.confirmed) throw new DomainError('NOT_CONFIRMED', 'Только подтвержденные участники могут отмечать оплату');

    reg.markPaid(game);
    await registrationRepo.upsert(reg);
    logger.info('Payment marked', { gameId, userId });
    await eventPublisher.publish(evt('PaymentMarked', { gameId, userId }));

    return { ok: true };
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

    const g = new Game(uuid(), data.organizerId, data.venueId, data.startsAt, data.capacity, data.levelTag, data.priceText);
    await gameRepo.insertGame(g);
    logger.info('Game created', { gameId: g.id });
    await eventPublisher.publish(evt('GameCreated', {
      gameId: g.id,
      startsAt: g.startsAt.toISOString(),
      capacity: g.capacity,
      levelTag: g.levelTag,
      priceText: g.priceText
    }));
    return g;
  }

  /**
   * Регистрирует пользователя.
   * @param {number} telegramId - Telegram ID пользователя.
   * @param {string} name - Имя пользователя.
   * @returns {Promise<{ userId: string }>} - ID созданного пользователя.
   */
  export async function registerUser(telegramId: number, name: string) {
    if (telegramId <= 0) {
      throw new DomainError('INVALID_INPUT', 'telegramId должен быть положительным числом');
    }
    if (!name?.trim()) {
      throw new DomainError('INVALID_INPUT', 'name не может быть пустым');
    }

    logger.info('registerUser called', { telegramId, name });

    const user = await prisma.user.upsert({
      where: { telegramId },
      update: { name },
      create: { telegramId, name }
    });
    logger.info('User registered', { userId: user.id, telegramId });
    return { userId: user.id };
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

    await prisma.user.update({
      where: { id: userId },
      data: { levelTag }
    });
    logger.info('User level updated', { userId, levelTag });
    return { ok: true };
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

    await prisma.organizer.upsert({
      where: { userId },
      update: {},
      create: { userId, title }
    });
    logger.info('Organizer registered', { userId, title });
    return { ok: true };
  }

  /**
   * Получает список игр.
   * @returns {Promise<Game[]>} - Список игр.
   */
  export async function listGames() {
    const games = await prisma.game.findMany({
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