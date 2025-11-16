import { GameRepo, RegistrationRepo, OrganizerRepo, PrismaOrganizerRepo } from '../../infrastructure/repositories/index.js';
import { EventBus } from '../../shared/event-bus.js';
import { GameDomainService } from '../../domain/services/game-domain-service.js';
import { SchedulerService } from '../../shared/scheduler-service.js';
import { v4 as uuid } from 'uuid';
import { Game } from '../../domain/game.js';
import { logger } from '../../shared/logger.js';
import { BusinessRuleError } from '../../domain/errors/business-rule-error.js';
import { metrics } from '../../shared/metrics.js';
import { LoggerFactory } from '../../shared/layer-logger.js';
import { LOG_MESSAGES } from '../../shared/logging-messages.js';
import { RegStatus } from '../../domain/registration.js';

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

export interface RegisterOrganizerCommand {
  userId: string;
  title: string;
}

export class GameApplicationService {
  constructor(
    private gameRepo: GameRepo,
    private registrationRepo: RegistrationRepo,
    private organizerRepo: OrganizerRepo,
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
   */
  async joinGame(command: JoinGameCommand): Promise<{ status: RegStatus; isReactivation?: boolean }> {
    return await this.gameRepo.transaction(async () => {
      const result = await this.gameDomainService.processJoinGame(
        command.gameId,
        command.userId
      );

      metrics.registrationsProcessed.increment();

      // Публикуем событие только если это новая регистрация или повторная после отмены
      // (не для случая, когда игрок уже в листе ожидания)
      if (result.isReactivation !== false) {
        await this.eventBus.publish({
          type: 'PlayerJoined',
          payload: {
            gameId: command.gameId,
            userId: command.userId,
            status: result.status
          },
          occurredAt: new Date(),
        });
      }

      return result;
    });
  }

  /**
   * Создает новую игру
   * Валидирует организатора и создает игру с планированием напоминаний
   * @param command - Команда с параметрами игры
   * @returns Созданная игра
   * @throws DomainError если организатор не найден
   */
  async createGame(command: CreateGameCommand): Promise<Game> {
    const serviceLogger = LoggerFactory.service('game-service');
    const correlationId = `create_game_${command.organizerId}_${Date.now()}`;

    serviceLogger.info('createGame', LOG_MESSAGES.SERVICES.GAME_SERVICE_CREATE_START,
      { organizerId: command.organizerId, venueId: command.venueId, capacity: command.capacity },
      { correlationId }
    );

    // Get organizer record to ensure it exists
    const organizer = await this.organizerRepo.findByUserId(command.organizerId);
    if (!organizer) {
      serviceLogger.error('createGame', LOG_MESSAGES.SERVICES.GAME_SERVICE_ORGANIZER_NOT_FOUND,
        new BusinessRuleError('NOT_FOUND', 'Организатор не найден'),
        { organizerId: command.organizerId },
        { correlationId }
      );
      throw new BusinessRuleError('NOT_FOUND', 'Организатор не найден');
    }

    // Check if venue is available at the specified time
    const conflictingGame = await this.gameRepo.findConflictingGame(command.venueId, command.startsAt);
    if (conflictingGame) {
      serviceLogger.warn('createGame', LOG_MESSAGES.SERVICES.GAME_SERVICE_VENUE_CONFLICT,
        { venueId: command.venueId, startsAt: command.startsAt, conflictingGameId: conflictingGame.id },
        { correlationId }
      );
      throw new BusinessRuleError('VENUE_OCCUPIED', `Площадка занята в это время. Конфликтующая игра: ${conflictingGame.id}`);
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
    serviceLogger.database('createGame', 'games', 'INSERT', {
      gameId: g.id,
      organizerId: organizer.id,
      venueId: command.venueId
    });

    serviceLogger.info('createGame', LOG_MESSAGES.SERVICES.GAME_SERVICE_CREATE_COMPLETED,
      { gameId: g.id, organizerId: command.organizerId },
      { correlationId, executionTimeMs: Date.now() - parseInt(correlationId.split('_')[2] || '0') }
    );

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
      throw new BusinessRuleError('NOT_FOUND', 'Игра не найдена');
    }

    game.finish();
    await this.gameRepo.updateStatus(gameId, game.status);

    // Schedule payment reminders after game finishes
    await this.schedulerService.schedulePaymentReminder12h(gameId, game.startsAt);
    await this.schedulerService.schedulePaymentReminder24h(gameId, game.startsAt);

    logger.info('Game finished and payment reminders scheduled', { gameId });
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