import { GameRepo, RegistrationRepo } from '../../infrastructure/repositories.js';
import { EventBus } from '../../shared/event-bus.js';
import { GameDomainService } from '../../domain/services/game-domain-service.js';
import { SchedulerService } from '../../shared/scheduler-service.js';
import { v4 as uuid } from 'uuid';
import { Game } from '../../domain/game.js';
import { logger } from '../../shared/logger.js';
import { DomainError } from '../../domain/errors.js';
import { metrics } from '../../shared/metrics.js';

export interface MarkPaymentCommand {
  gameId: string;
  userId: string;
}

export interface JoinGameCommand {
  gameId: string;
  userId: string;
}

export interface CreateGameCommand {
  organizerId: string;
  venueId: string;
  startsAt: Date;
  capacity: number;
  levelTag?: string;
  priceText?: string;
}

export interface RegisterUserCommand {
  telegramId: number | bigint;
  name: string;
}

export interface UpdateUserLevelCommand {
  userId: string;
  levelTag?: string;
}

export interface RegisterOrganizerCommand {
  userId: string;
  title: string;
}

export class GameApplicationService {
  constructor(
    private gameRepo: GameRepo,
    private registrationRepo: RegistrationRepo,
    private eventBus: EventBus,
    private gameDomainService: GameDomainService,
    private schedulerService: SchedulerService
  ) {}

  /**
   * Отмечает оплату за игру
   * Проверяет бизнес-правила оплаты и обновляет статус регистрации
   * @param command - Команда с gameId и userId
   * @throws DomainError если оплата недоступна или игра не найдена
   * @example
   * await gameService.markPayment({ gameId: '123', userId: '456' });
   */
  async markPayment(command: MarkPaymentCommand): Promise<void> {
    try {
      const { game, registration } = await this.gameDomainService
        .validatePaymentMarking(command.gameId, command.userId);

      // Доменная логика
      registration.markPaid(game);

      // Персистенция
      await this.registrationRepo.upsert(registration);

      // События - отложенная обработка через event bus
      await this.eventBus.publish({
        type: 'PaymentMarked',
        payload: { gameId: command.gameId, userId: command.userId },
        occurredAt: new Date(),
      });
    } catch (error: any) {
      // Публикуем событие об ошибке оплаты
      if (error.code === 'PAYMENT_WINDOW_NOT_OPEN') {
        await this.eventBus.publish({
          type: 'PaymentAttemptRejectedEarly',
          payload: { gameId: command.gameId, userId: command.userId },
          occurredAt: new Date(),
        });
      }
      throw error;
    }
  }

  /**
   * Записывает игрока на игру
   * Обрабатывает запись в основной состав или в лист ожидания
   * @param command - Команда с gameId и userId
   * @returns Статус записи ('registered' или 'waitlisted')
   * @throws DomainError если игра не найдена или заполнена
   * @example
   * const result = await gameService.joinGame({ gameId: '123', userId: '456' });
   * console.log(result.status); // 'registered' или 'waitlisted'
   */
  async joinGame(command: JoinGameCommand): Promise<{ status: string }> {
    return await this.gameRepo.transaction(async () => {
      const result = await this.gameDomainService.processJoinGame(
        command.gameId,
        command.userId
      );

      metrics.registrationsProcessed.increment();

      await this.eventBus.publish({
        type: 'PlayerJoined',
        payload: {
          gameId: command.gameId,
          userId: command.userId,
          status: result.status
        },
        occurredAt: new Date(),
      });

      return result;
    });
  }

  /**
   * Создает новую игру
   * Валидирует организатора и создает игру с планированием напоминаний
   * @param command - Команда с параметрами игры
   * @returns Созданная игра
   * @throws DomainError если организатор не найден
   * @example
   * const game = await gameService.createGame({
   *   organizerId: '123',
   *   venueId: 'venue1',
   *   startsAt: new Date('2025-12-01T10:00:00Z'),
   *   capacity: 12,
   *   levelTag: 'amateur',
   *   priceText: '500 руб'
   * });
   */
  async createGame(command: CreateGameCommand): Promise<Game> {
    // Get organizer record to ensure it exists
    const organizer = await (this.gameRepo as any).getOrganizerByUserId(command.organizerId);
    if (!organizer) {
      throw new DomainError('NOT_FOUND', 'Организатор не найден');
    }

    // Check if venue is available at the specified time
    const conflictingGame = await this.gameRepo.findConflictingGame(command.venueId, command.startsAt);
    if (conflictingGame) {
      throw new DomainError('VENUE_OCCUPIED', `Площадка занята в это время. Конфликтующая игра: ${conflictingGame.id}`);
    }

    const g = new Game(
      uuid(),
      organizer.id,
      command.venueId,
      command.startsAt,
      command.capacity,
      command.levelTag,
      command.priceText
    );

    await this.gameRepo.insertGame(g);
    logger.info('Game created', { gameId: g.id });
    metrics.gamesCreated.increment();

    // Установить время закрытия приоритетного окна (2 часа до начала игры)
    const priorityWindowClosesAt = new Date(g.startsAt.getTime() - 2 * 60 * 60 * 1000);
    await this.gameRepo.updatePriorityWindow(g.id, priorityWindowClosesAt);

    // Получить всех подтвержденных игроков организатора
    const { prisma } = await import('../../infrastructure/prisma.js');
    const confirmedPlayers = await (prisma as any).playerOrganizer.findMany({
      where: {
        organizerId: organizer.id,
        status: 'confirmed'
      },
      include: { player: true }
    });

    // Создать записи GamePlayerResponse со статусом 'ignored' (ожидание ответа)
    const responses = confirmedPlayers.map((po: any) => ({
      gameId: g.id,
      playerId: po.player.id,
      response: 'ignored' as const
    }));

    if (responses.length > 0) {
      await (prisma as any).gamePlayerResponse.createMany({
        data: responses,
        skipDuplicates: true
      });
    }

    // Запланировать проверку истечения приоритетного окна через 2 часа
    await this.schedulerService.schedulePriorityWindowCheck(g.id, priorityWindowClosesAt);

    // Опубликовать событие о создании игры с приоритетным окном
    // Если есть приоритетные игроки - отправляем им приглашение
    // Если нет - сразу открываем для всех
    if (confirmedPlayers.length > 0) {
      await this.eventBus.publish({
        type: 'GameCreatedWithPriorityWindow',
        occurredAt: new Date(),
        id: '',
        payload: {
          gameId: g.id,
          priorityWindowClosesAt: priorityWindowClosesAt.toISOString(),
          confirmedPlayers: confirmedPlayers.map((po: any) => ({
            playerId: po.player.id,
            telegramId: po.player.telegramId
          }))
        }
      });
    } else {
      // Нет приоритетных игроков - сразу открываем для всех
      await this.eventBus.publish({
        type: 'GamePublishedForAll',
        occurredAt: new Date(),
        id: '',
        payload: { gameId: g.id }
      });
    }

    // Schedule reminders
    await this.schedulerService.scheduleGameReminder24h(g.id, g.startsAt);
    await this.schedulerService.initializeWorkers();

    return g;
  }

  async finishGame(gameId: string): Promise<void> {
    const game = await this.gameRepo.findById(gameId);
    if (!game) {
      throw new DomainError('NOT_FOUND', 'Игра не найдена');
    }

    game.finish();
    await this.gameRepo.updateStatus(gameId, game.status);

    // Schedule payment reminders after game finishes
    await this.schedulerService.schedulePaymentReminder12h(gameId, game.startsAt);
    await this.schedulerService.schedulePaymentReminder24h(gameId, game.startsAt);

    logger.info('Game finished and payment reminders scheduled', { gameId });
  }

  async registerUser(command: RegisterUserCommand): Promise<{ userId: string }> {
    const user = await this.gameRepo.transaction(async () => {
      // Note: This is a simple upsert, no complex business logic needed
      // Could be moved to a separate UserApplicationService if needed
      const { prisma } = await import('../../infrastructure/prisma.js');
      const user = await prisma.user.upsert({
        where: { telegramId: command.telegramId },
        update: { name: command.name },
        create: { telegramId: command.telegramId, name: command.name }
      });
      return user;
    });

    logger.info('User registered', { userId: user.id, telegramId: command.telegramId });
    return { userId: user.id };
  }

  async updateUserLevel(command: UpdateUserLevelCommand): Promise<{ ok: boolean }> {
    await this.gameRepo.transaction(async () => {
      const { prisma } = await import('../../infrastructure/prisma.js');
      await prisma.user.update({
        where: { id: command.userId },
        data: { levelTag: command.levelTag }
      });
    });

    logger.info('User level updated', { userId: command.userId, levelTag: command.levelTag });
    return { ok: true };
  }

  async registerOrganizer(command: RegisterOrganizerCommand): Promise<{ ok: boolean }> {
    await this.gameRepo.transaction(async () => {
      const { prisma } = await import('../../infrastructure/prisma.js');
      await prisma.organizer.upsert({
        where: { userId: command.userId },
        update: {},
        create: { userId: command.userId, title: command.title }
      });
    });

    logger.info('Organizer registered', { userId: command.userId, title: command.title });
    return { ok: true };
  }
}