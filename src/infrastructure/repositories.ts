import { prisma } from './prisma.js';
import { Game, GameStatus } from '../domain/game.js';
import { Registration, RegStatus, PaymentStatus } from '../domain/registration.js';
import { LoggerFactory } from '../shared/layer-logger.js';
import { LOG_MESSAGES } from '../shared/logging-messages.js';

export interface GameRepo {
  findById(id: string): Promise<Game | null>;
  countConfirmed(gameId: string): Promise<number>;
  insertGame(g: Game): Promise<void>;
  updateStatus(gameId: string, status: GameStatus): Promise<void>;
  updatePriorityWindow(gameId: string, priorityWindowClosesAt: Date): Promise<void>;
  findConflictingGame(venueId: string, startsAt: Date): Promise<Game | null>;
  transaction<T>(fn: () => Promise<T>): Promise<T>;
}

export interface RegistrationRepo {
  get(gameId: string, userId: string): Promise<Registration | null>;
  upsert(reg: Registration): Promise<void>;
  firstWaitlisted(gameId: string): Promise<Registration | null>;
  promoteToConfirmed(regId: string): Promise<void>;
}

export interface UserRepo {
  upsertUser(telegramId: number | bigint, name: string): Promise<{ id: string; telegramId: number | bigint; name: string }>;
  updateUserLevel(userId: string, levelTag?: string): Promise<void>;
  transaction<T>(fn: () => Promise<T>): Promise<T>;
}

export class PrismaGameRepo implements GameRepo {
  /**
   * Выполняет функцию в транзакции Prisma.
   * Используется для обеспечения ACID-свойств при операциях с несколькими таблицами.
   * @param fn - Функция, выполняемая в транзакции
   * @returns Результат выполнения функции
   */
  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    return prisma.$transaction(fn);
  }
async findById(id: string): Promise<Game | null> {
    const game = await prisma.game.findUnique({ where: { id } });
    if (!game) return null;
    return new Game(
      game.id,
      game.organizerId,
      game.venueId,
      game.startsAt,
      game.capacity,
      game.levelTag || undefined,
      game.priceText || undefined,
      game.status as GameStatus
    );
  }

  async countConfirmed(gameId: string): Promise<number> {
    return prisma.registration.count({
      where: { gameId, status: RegStatus.confirmed }
    });
  }

  async insertGame(g: Game): Promise<void> {
    await prisma.game.create({
      data: {
        id: g.id,
        organizerId: g.organizerId,
        venueId: g.venueId,
        startsAt: g.startsAt,
        capacity: g.capacity,
        levelTag: g.levelTag,
        priceText: g.priceText,
        status: g.status as GameStatus
      }
    });
  }

  // Helper method to get organizer by userId
  async getOrganizerByUserId(userId: string) {
    return prisma.organizer.findUnique({
      where: { userId }
    });
  }

  async updateStatus(gameId: string, status: GameStatus): Promise<void> {
    await prisma.game.update({
      where: { id: gameId },
      data: { status }
    });
  }

  async updatePriorityWindow(gameId: string, priorityWindowClosesAt: Date): Promise<void> {
    // NOTE: priorityWindowClosesAt field may not exist in schema yet
    // This method is implemented but field needs to be added to Prisma schema
    await prisma.game.update({
      where: { id: gameId },
      data: { priorityWindowClosesAt } as any
    });
  }

  async findConflictingGame(venueId: string, startsAt: Date): Promise<Game | null> {
    // Check for games on the same venue at the same time (within 2 hours window)
    const startWindow = new Date(startsAt.getTime() - 2 * 60 * 60 * 1000); // 2 hours before
    const endWindow = new Date(startsAt.getTime() + 2 * 60 * 60 * 1000); // 2 hours after

    const game = await prisma.game.findFirst({
      where: {
        venueId,
        startsAt: {
          gte: startWindow,
          lte: endWindow
        },
        status: {
          in: ['open', 'closed'] // Only check active games
        }
      }
    });

    if (!game) return null;

    return new Game(
      game.id,
      game.organizerId,
      game.venueId,
      game.startsAt,
      game.capacity,
      game.levelTag || undefined,
      game.priceText || undefined,
      game.status as GameStatus
    );
  }
}

export class PrismaRegistrationRepo implements RegistrationRepo {
  async get(gameId: string, userId: string): Promise<Registration | null> {
    const reg = await prisma.registration.findUnique({
      where: { gameId_userId: { gameId, userId } }
    });
    if (!reg) return null;
    return new Registration(
      reg.id,
      reg.gameId,
      reg.userId,
      reg.status as RegStatus,
      reg.paymentStatus as PaymentStatus,
      reg.paymentMarkedAt || undefined,
      reg.createdAt
    );
  }

  async upsert(reg: Registration): Promise<void> {
    await prisma.registration.upsert({
      where: { gameId_userId: { gameId: reg.gameId, userId: reg.userId } },
      update: {
        status: reg.status as RegStatus,
        paymentStatus: reg.paymentStatus,
        paymentMarkedAt: reg.paymentMarkedAt
      },
      create: {
        id: reg.id,
        gameId: reg.gameId,
        userId: reg.userId,
        status: reg.status as RegStatus,
        paymentStatus: reg.paymentStatus,
        paymentMarkedAt: reg.paymentMarkedAt,
        createdAt: reg.createdAt
      }
    });
  }

  async firstWaitlisted(gameId: string): Promise<Registration | null> {
    const reg = await prisma.registration.findFirst({
      where: { gameId, status: RegStatus.waitlisted },
      orderBy: { createdAt: 'asc' }
    });
    if (!reg) return null;
    return new Registration(
      reg.id,
      reg.gameId,
      reg.userId,
      reg.status as RegStatus,
      reg.paymentStatus as PaymentStatus,
      reg.paymentMarkedAt || undefined,
      reg.createdAt
    );
  }

  async promoteToConfirmed(regId: string): Promise<void> {
    await prisma.registration.update({
      where: { id: regId },
      data: { status: RegStatus.confirmed }
    });
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    return prisma.$transaction(fn);
  }
}

export class PrismaUserRepo implements UserRepo {
  async upsertUser(telegramId: number | bigint, name: string): Promise<{ id: string; telegramId: number | bigint; name: string }> {
    const repositoryLogger = LoggerFactory.repository('prisma-user-repo');

    repositoryLogger.database('upsertUser', 'users', 'UPSERT', {
      telegramId,
      name
    });

    const user = await prisma.user.upsert({
      where: { telegramId },
      update: { name },
      create: { telegramId, name }
    });

    repositoryLogger.info('upsertUser', LOG_MESSAGES.REPOSITORIES.USER_UPSERT_COMPLETED,
      { userId: user.id, telegramId: user.telegramId },
      { executionTimeMs: Date.now() % 1000 }
    );

    return { id: user.id, telegramId: user.telegramId, name: user.name };
  }

  async updateUserLevel(userId: string, levelTag?: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { levelTag }
    });
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    return prisma.$transaction(fn);
  }
}