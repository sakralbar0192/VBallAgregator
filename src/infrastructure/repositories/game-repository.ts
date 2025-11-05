import { Game, GameStatus } from '../../domain/game.js';
import { BasePrismaRepository } from './base-repository.js';
import { prisma } from '../prisma.js';

/**
 * Интерфейс репозитория для работы с играми
 */
export interface GameRepo {
  /**
   * Находит игру по идентификатору
   * @param id - Идентификатор игры
   * @returns Игра или null, если не найдена
   */
  findById(id: string): Promise<Game | null>;

  /**
   * Подсчитывает количество подтвержденных регистраций на игру
   * @param gameId - Идентификатор игры
   * @returns Количество подтвержденных регистраций
   */
  countConfirmed(gameId: string): Promise<number>;

  /**
   * Создает новую игру
   * @param g - Объект игры для создания
   */
  insertGame(g: Game): Promise<void>;

  /**
   * Обновляет статус игры
   * @param gameId - Идентификатор игры
   * @param status - Новый статус игры
   */
  updateStatus(gameId: string, status: GameStatus): Promise<void>;

  /**
   * Обновляет время закрытия приоритетного окна
   * @param gameId - Идентификатор игры
   * @param priorityWindowClosesAt - Время закрытия приоритетного окна
   */
  updatePriorityWindow(gameId: string, priorityWindowClosesAt: Date): Promise<void>;

  /**
   * Ищет конфликтующие игры на той же площадке в заданное время
   * @param venueId - Идентификатор площадки
   * @param startsAt - Время начала игры
   * @returns Конфликтующая игра или null
   */
  findConflictingGame(venueId: string, startsAt: Date): Promise<Game | null>;

  /**
   * Выполняет функцию в транзакции
   * @param fn - Функция для выполнения в транзакции
   * @returns Результат выполнения функции
   */
  transaction<T>(fn: () => Promise<T>): Promise<T>;
}

/**
 * Реализация репозитория игр с использованием Prisma
 */
export class PrismaGameRepo extends BasePrismaRepository implements GameRepo {
  /**
   * Создает экземпляр репозитория игр
   */
  constructor() {
    super('prisma-game-repo');
  }

  /**
   * @inheritDoc
   */
  async findById(id: string): Promise<Game | null> {
    this.validateRequired(id, 'id');

    return this.executeWithLogging('findById', 'games', 'SELECT', { id }, async () => {
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
    });
  }

  /**
   * @inheritDoc
   */
  async countConfirmed(gameId: string): Promise<number> {
    this.validateRequired(gameId, 'gameId');

    return this.executeWithLogging('countConfirmed', 'registrations', 'COUNT', { gameId }, async () => {
      return prisma.registration.count({
        where: { gameId, status: 'confirmed' }
      });
    });
  }

  /**
   * @inheritDoc
   */
  async insertGame(g: Game): Promise<void> {
    this.validateRequired(g, 'game');
    this.validateRequired(g.id, 'game.id');
    this.validateRequired(g.organizerId, 'game.organizerId');
    this.validateRequired(g.venueId, 'game.venueId');
    this.validateDate(g.startsAt, 'game.startsAt');
    this.validatePositiveNumber(g.capacity, 'game.capacity');

    await this.executeWithLogging('insertGame', 'games', 'INSERT', {
      id: g.id,
      organizerId: g.organizerId,
      venueId: g.venueId,
      startsAt: g.startsAt,
      capacity: g.capacity,
      levelTag: g.levelTag,
      priceText: g.priceText,
      status: g.status
    }, async () => {
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
    });
  }

  /**
   * @inheritDoc
   */
  async updateStatus(gameId: string, status: GameStatus): Promise<void> {
    this.validateRequired(gameId, 'gameId');
    this.validateEnum(status, 'status', Object.values(GameStatus));

    await this.executeWithLogging('updateStatus', 'games', 'UPDATE', { gameId, status }, async () => {
      await prisma.game.update({
        where: { id: gameId },
        data: { status }
      });
    });
  }

  /**
   * @inheritDoc
   */
  async updatePriorityWindow(gameId: string, priorityWindowClosesAt: Date): Promise<void> {
    this.validateRequired(gameId, 'gameId');
    this.validateDate(priorityWindowClosesAt, 'priorityWindowClosesAt');

    await this.executeWithLogging('updatePriorityWindow', 'games', 'UPDATE', { gameId, priorityWindowClosesAt }, async () => {
      await prisma.game.update({
        where: { id: gameId },
        data: { priorityWindowClosesAt } as any
      });
    });
  }

  /**
   * @inheritDoc
   */
  async findConflictingGame(venueId: string, startsAt: Date): Promise<Game | null> {
    this.validateRequired(venueId, 'venueId');
    this.validateDate(startsAt, 'startsAt');

    return this.executeWithLogging('findConflictingGame', 'games', 'SELECT', { venueId, startsAt }, async () => {
      // Проверяем игры на той же площадке в то же время (в окне 2 часов)
      const startWindow = new Date(startsAt.getTime() - 2 * 60 * 60 * 1000); // 2 часа до
      const endWindow = new Date(startsAt.getTime() + 2 * 60 * 60 * 1000); // 2 часа после

      const game = await prisma.game.findFirst({
        where: {
          venueId,
          startsAt: {
            gte: startWindow,
            lte: endWindow
          },
          status: {
            in: ['open', 'closed'] // Проверяем только активные игры
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
    });
  }

  /**
   * @inheritDoc
   */
  override async transaction<T>(fn: () => Promise<T>): Promise<T> {
    return super.transaction(fn);
  }
}