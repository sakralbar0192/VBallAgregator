import { BasePrismaRepository } from './base-repository.js';
import { prisma } from '../prisma.js';
import { LOG_MESSAGES } from '../../shared/logging-messages.js';
import type { SportKind } from '@prisma/client';

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

  updateUserActiveSport(userId: string, sport: 'volleyball' | 'tennis'): Promise<void>;

  /**
   * Частичное обновление демографии пользователя (пол и/или возрастной диапазон).
   */
  updateUserDemographics(userId: string, data: { gender?: string; ageBand?: string }): Promise<void>;

  /**
   * Строка профиля по виду спорта: для волейбола — поля формата/уровня/флага организатора; для тенниса — пустая строка-«маркер» завершённости онбординга.
   */
  upsertUserSportProfileRow(
    userId: string,
    sport: SportKind,
    volleyball?: {
      volleyballSkillTag: string | null;
      volleyballFormats: string | null;
      wantsOrganizeVolleyball: boolean;
    },
  ): Promise<void>;

  updateUserVolleyballOnboardingSummary(userId: string, levelTag: string | undefined): Promise<void>;

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

  async updateUserActiveSport(userId: string, sport: 'volleyball' | 'tennis'): Promise<void> {
    this.validateRequired(userId, 'userId');
    await this.executeWithLogging('updateUserActiveSport', 'users', 'UPDATE', { userId, sport }, async () => {
      await prisma.user.update({
        where: { id: userId },
        data: { activeSport: sport },
      });
    });
  }

  async updateUserDemographics(userId: string, data: { gender?: string; ageBand?: string }): Promise<void> {
    this.validateRequired(userId, 'userId');
    const patch: { gender?: string; ageBand?: string } = {};
    if (data.gender !== undefined) patch.gender = data.gender;
    if (data.ageBand !== undefined) patch.ageBand = data.ageBand;
    if (Object.keys(patch).length === 0) return;

    await this.executeWithLogging('updateUserDemographics', 'users', 'UPDATE', { userId, ...patch }, async () => {
      await prisma.user.update({
        where: { id: userId },
        data: patch,
      });
    });
  }

  async upsertUserSportProfileRow(
    userId: string,
    sport: SportKind,
    volleyball?: {
      volleyballSkillTag: string | null;
      volleyballFormats: string | null;
      wantsOrganizeVolleyball: boolean;
    },
  ): Promise<void> {
    this.validateRequired(userId, 'userId');
    await this.executeWithLogging('upsertUserSportProfileRow', 'user_sport_profiles', 'UPSERT', { userId, sport }, async () => {
      if (sport === 'volleyball' && volleyball) {
        await prisma.userSportProfile.upsert({
          where: { userId_sport: { userId, sport } },
          create: {
            userId,
            sport,
            volleyballSkillTag: volleyball.volleyballSkillTag,
            volleyballFormats: volleyball.volleyballFormats,
            wantsOrganizeVolleyball: volleyball.wantsOrganizeVolleyball,
          },
          update: {
            volleyballSkillTag: volleyball.volleyballSkillTag,
            volleyballFormats: volleyball.volleyballFormats,
            wantsOrganizeVolleyball: volleyball.wantsOrganizeVolleyball,
          },
        });
        return;
      }

      await prisma.userSportProfile.upsert({
        where: { userId_sport: { userId, sport } },
        create: { userId, sport },
        update: {},
      });
    });
  }

  async updateUserVolleyballOnboardingSummary(userId: string, levelTag: string | undefined): Promise<void> {
    this.validateRequired(userId, 'userId');
    await this.executeWithLogging('updateUserVolleyballOnboardingSummary', 'users', 'UPDATE', { userId, levelTag }, async () => {
      await prisma.user.update({
        where: { id: userId },
        data: { levelTag: levelTag ?? undefined, activeSport: 'volleyball' },
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