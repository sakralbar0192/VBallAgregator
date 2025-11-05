import { BasePrismaRepository } from './base-repository.js';
import { prisma } from '../prisma.js';

/**
 * Интерфейс репозитория для работы с организаторами
 */
export interface OrganizerRepo {
  /**
   * Находит организатора по ID пользователя
   * @param userId - Идентификатор пользователя
   * @returns Организатор или null, если не найден
   */
  findByUserId(userId: string): Promise<any | null>;
}

/**
 * Реализация репозитория организаторов с использованием Prisma
 */
export class PrismaOrganizerRepo extends BasePrismaRepository implements OrganizerRepo {
  /**
   * Создает экземпляр репозитория организаторов
   */
  constructor() {
    super('prisma-organizer-repo');
  }

  /**
   * @inheritDoc
   */
  async findByUserId(userId: string): Promise<any | null> {
    this.validateRequired(userId, 'userId');

    return this.executeWithLogging('findByUserId', 'organizers', 'SELECT', { userId }, async () => {
      return prisma.organizer.findUnique({
        where: { userId }
      });
    });
  }
}