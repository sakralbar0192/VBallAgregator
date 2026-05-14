import { Registration, RegStatus, PaymentStatus } from '../../domain/registration.js';
import { BasePrismaRepository } from './base-repository.js';
import { prisma } from '../prisma.js';
import { prismaForContext } from '../prisma-client-for-context.js';
import type { QueryContext } from '../../../../contracts/src/query-context.js';

/**
 * Интерфейс репозитория для работы с регистрациями
 */
export interface RegistrationRepo {
  /**
   * Получает регистрацию по игре и пользователю
   * @param gameId - Идентификатор игры
   * @param userId - Идентификатор пользователя
   * @returns Регистрация или null, если не найдена
   */
  get(gameId: string, userId: string, ctx?: QueryContext): Promise<Registration | null>;

  /**
   * Создает или обновляет регистрацию
   * @param reg - Объект регистрации
   */
  upsert(reg: Registration, ctx?: QueryContext): Promise<void>;

  /**
   * Находит первую регистрацию в списке ожидания для игры
   * @param gameId - Идентификатор игры
   * @returns Первая регистрация в списке ожидания или null
   */
  firstWaitlisted(gameId: string, ctx?: QueryContext): Promise<Registration | null>;

  /**
   * Повышает регистрацию до подтвержденной
   * @param regId - Идентификатор регистрации
   */
  promoteToConfirmed(regId: string, ctx?: QueryContext): Promise<void>;
}

/**
 * Реализация репозитория регистраций с использованием Prisma
 */
export class PrismaRegistrationRepo extends BasePrismaRepository implements RegistrationRepo {
  /**
   * Создает экземпляр репозитория регистраций
   */
  constructor() {
    super('prisma-registration-repo');
  }

  /**
   * @inheritDoc
   */
  async get(gameId: string, userId: string, ctx?: QueryContext): Promise<Registration | null> {
    this.validateRequired(gameId, 'gameId');
    this.validateRequired(userId, 'userId');

    return this.executeWithLogging('get', 'registrations', 'SELECT', { gameId, userId }, async () => {
      const db = prismaForContext(ctx);
      const reg = await db.registration.findUnique({
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
    });
  }

  /**
   * @inheritDoc
   */
  async upsert(reg: Registration, ctx?: QueryContext): Promise<void> {
    this.validateRequired(reg, 'registration');
    this.validateRequired(reg.id, 'registration.id');
    this.validateRequired(reg.gameId, 'registration.gameId');
    this.validateRequired(reg.userId, 'registration.userId');
    this.validateEnum(reg.status, 'registration.status', Object.values(RegStatus));
    this.validateEnum(reg.paymentStatus, 'registration.paymentStatus', Object.values(PaymentStatus));

    await this.executeWithLogging('upsert', 'registrations', 'UPSERT', {
      id: reg.id,
      gameId: reg.gameId,
      userId: reg.userId,
      status: reg.status,
      paymentStatus: reg.paymentStatus,
      paymentMarkedAt: reg.paymentMarkedAt,
      createdAt: reg.createdAt
    }, async () => {
      const db = prismaForContext(ctx);
      await db.registration.upsert({
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
    });
  }

  /**
   * @inheritDoc
   */
  async firstWaitlisted(gameId: string, ctx?: QueryContext): Promise<Registration | null> {
    this.validateRequired(gameId, 'gameId');

    return this.executeWithLogging('firstWaitlisted', 'registrations', 'SELECT', { gameId }, async () => {
      const db = prismaForContext(ctx);
      const reg = await db.registration.findFirst({
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
    });
  }

  /**
   * @inheritDoc
   */
  async promoteToConfirmed(regId: string, ctx?: QueryContext): Promise<void> {
    this.validateRequired(regId, 'regId');

    await this.executeWithLogging('promoteToConfirmed', 'registrations', 'UPDATE', { regId }, async () => {
      const db = prismaForContext(ctx);
      await db.registration.update({
        where: { id: regId },
        data: { status: RegStatus.confirmed }
      });
    });
  }
}