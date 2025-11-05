import { Context } from 'telegraf';
import { prisma } from '../../infrastructure/prisma.js';
import { LoggerFactory } from '../../shared/layer-logger.js';
import { User, Organizer } from '../../infrastructure/prisma-types.js';

/**
 * Базовый класс для всех обработчиков бота
 * Предоставляет общие методы для работы с пользователями и валидации
 */
export abstract class BaseHandler {
  protected static logger = LoggerFactory.bot('base-handler');

  /**
   * Получить пользователя по telegramId из контекста
   */
  protected static async getUser(ctx: Context): Promise<User | null> {
    const telegramId = ctx.from?.id;
    if (!telegramId) return null;

    return await prisma.user.findUnique({
      where: { telegramId }
    });
  }

  /**
   * Получить организатора по userId
   */
  protected static async getOrganizer(userId: string): Promise<Organizer | null> {
    return await prisma.organizer.findUnique({
      where: { userId }
    });
  }

  /**
   * Валидировать gameId (простая проверка на UUID формат)
   */
  protected static validateGameId(gameId: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(gameId);
  }

  /**
   * Требовать наличие пользователя, иначе бросить ошибку
   */
  protected static async requireUser(ctx: Context): Promise<User> {
    const user = await this.getUser(ctx);
    if (!user) {
      throw new Error('Пользователь не найден. Начни с команды /start');
    }
    return user;
  }

  /**
   * Требовать наличие организатора, иначе бросить ошибку
   */
  protected static async requireOrganizer(ctx: Context): Promise<Organizer> {
    const user = await this.requireUser(ctx);
    const organizer = await this.getOrganizer(user.id);
    if (!organizer) {
      throw new Error('Ты не организатор этой игры');
    }
    return organizer;
  }

  /**
   * Создать correlationId для логирования
   */
  protected static createCorrelationId(ctx: Context, action: string): string {
    const telegramId = ctx.from?.id || 'unknown';
    return `${action}_${telegramId}_${Date.now()}`;
  }
}