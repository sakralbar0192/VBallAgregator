import { GameRepo, RegistrationRepo } from '../../infrastructure/repositories.js';
import { EventBus } from '../../shared/event-bus.js';
import { GameDomainService } from '../../domain/services/game-domain-service.js';
import { SchedulerService } from '../../shared/scheduler-service.js';
import { v4 as uuid } from 'uuid';
import { Game } from '../../domain/game.js';
import { eventPublisher, evt } from '../../shared/event-publisher.js';
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

  async createGame(command: CreateGameCommand): Promise<Game> {
    // Get organizer record to ensure it exists
    const organizer = await (this.gameRepo as any).getOrganizerByUserId(command.organizerId);
    if (!organizer) {
      throw new DomainError('NOT_FOUND', 'Организатор не найден');
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

    await eventPublisher.publish(evt('GameCreated', {
      gameId: g.id,
      startsAt: g.startsAt.toISOString(),
      capacity: g.capacity,
      levelTag: g.levelTag,
      priceText: g.priceText
    }));

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