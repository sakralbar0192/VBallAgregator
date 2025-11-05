import { BasePrismaRepository } from './base-repository.js';
import { prisma } from '../prisma.js';
import { LOG_MESSAGES } from '../../shared/logging-messages.js';

/**
 * Интерфейс репозитория для работы с пользователями
 */
export interface UserRepo {
  /**
   * Создает или обновляет пользователя
   * @param telegramId - Telegram ID пользователя
   * @param name - Имя пользователя
   * @returns Объект с данными пользователя
   */
  upsertUser(telegramId: number | bigint, name: string): Promise<{ id: string; telegramId: number | bigint; name: string }>;

  /**
   * Обновляет уровень пользователя
   * @param userId - Идентификатор пользователя
   * @param levelTag - Тег уровня (опционально)
   */
  updateUserLevel(userId: string, levelTag?: string): Promise<void>;

  /**
   * Выполняет функцию в транзакции
   * @param fn - Функция для выполнения в транзакции
   * @returns Результат выполнения функции
   */
  transaction<T>(fn: () => Promise<T>): Promise<T>;
}

/**
 * Реализация репозитория пользователей с использованием Prisma
 */
export class PrismaUserRepo extends BasePrismaRepository implements UserRepo {
  /**
   * Создает экземпляр репозитория пользователей
   */
  constructor() {
    super('prisma-user-repo');
  }

  /**
   * @inheritDoc
   */
  async upsertUser(telegramId: number | bigint, name: string): Promise<{ id: string; telegramId: number | bigint; name: string }> {
    this.validateRequired(telegramId, 'telegramId');
    this.validateStringLength(name, 'name', 1, 100);

    return this.executeWithLogging('upsertUser', 'users', 'UPSERT', { telegramId, name }, async () => {
      const user = await prisma.user.upsert({
        where: { telegramId },
        update: { name },
        create: { telegramId, name }
      });

      this.logger.info('upsertUser', LOG_MESSAGES.REPOSITORIES.USER_UPSERT_COMPLETED,
        { userId: user.id, telegramId: user.telegramId },
        { executionTimeMs: Date.now() % 1000 }
      );

      return { id: user.id, telegramId: user.telegramId, name: user.name };
    });
  }

  /**
   * @inheritDoc
   */
  async updateUserLevel(userId: string, levelTag?: string): Promise<void> {
    this.validateRequired(userId, 'userId');

    await this.executeWithLogging('updateUserLevel', 'users', 'UPDATE', { userId, levelTag }, async () => {
      await prisma.user.update({
        where: { id: userId },
        data: { levelTag }
      });
    });
  }

  /**
   * @inheritDoc
   */
  override async transaction<T>(fn: () => Promise<T>): Promise<T> {
    return super.transaction(fn);
  }
}