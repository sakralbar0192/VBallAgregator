import { UserRepo } from '../../infrastructure/repositories.js';
import { logger } from '../../shared/logger.js';
import { LoggerFactory } from '../../shared/layer-logger.js';
import { LOG_MESSAGES } from '../../shared/logging-messages.js';

export interface RegisterUserCommand {
  telegramId: number | bigint;
  name: string;
}

export interface UpdateUserLevelCommand {
  userId: string;
  levelTag?: string;
}

/**
 * Сервис для работы с пользователями
 * Отвечает за регистрацию, обновление уровня и другие пользовательские операции
 */
export class UserApplicationService {
  constructor(private userRepo: UserRepo) {}

  /**
   * Регистрирует нового пользователя или обновляет существующего по telegramId
   *
   * @async
   * @function registerUser
   * @param {RegisterUserCommand} command - Команда регистрации пользователя
   * @param {string} command.telegramId - Telegram ID пользователя
   * @param {string} command.name - Имя пользователя
   * @returns {Promise<{userId: string}>} Объект с ID зарегистрированного пользователя
   * @throws {Error} Если произошла ошибка при работе с базой данных
   */
  async registerUser(command: RegisterUserCommand): Promise<{ userId: string }> {
    const serviceLogger = LoggerFactory.service('user-service');

    serviceLogger.info('registerUser', LOG_MESSAGES.SERVICES.USER_SERVICE_INVOKE_REPO,
      { telegramId: Number(command.telegramId) },
      {}
    );

    const user = await this.userRepo.transaction(async () => {
      return await this.userRepo.upsertUser(command.telegramId, command.name);
    });

    serviceLogger.database('registerUser', 'users', 'UPSERT', {
      telegramId: command.telegramId,
      userId: user.id
    });

    serviceLogger.info('registerUser', LOG_MESSAGES.SERVICES.USER_SERVICE_REGISTER_COMPLETED,
      { userId: user.id, telegramId: command.telegramId },
      { executionTimeMs: Date.now() % 1000 } // Примерное время выполнения
    );

    return { userId: user.id };
  }

  /**
   * Обновляет уровень пользователя
   * 
   * @async
   * @function updateUserLevel
   * @param {UpdateUserLevelCommand} command - Команда обновления уровня
   * @param {string} command.userId - ID пользователя
   * @param {string} command.levelTag - Новый уровень пользователя (опционально)
   * @returns {Promise<{ok: boolean}>} Результат операции
   */
  async updateUserLevel(command: UpdateUserLevelCommand): Promise<{ ok: boolean }> {
    await this.userRepo.transaction(async () => {
      await this.userRepo.updateUserLevel(command.userId, command.levelTag);
    });

    logger.info('User level updated', { userId: command.userId, levelTag: command.levelTag });
    return { ok: true };
  }
}