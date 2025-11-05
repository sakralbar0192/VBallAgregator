/**
 * Константы для сообщений логирования
 * Организованы по архитектурным слоям и компонентам для обеспечения консистентности
 */

export const LOG_MESSAGES = {
  // Presentation Layer - Bot handlers
  BOT: {
    START_COMMAND_INITIATED: 'Пользователь инициировал команду /start',
    START_COMMAND_FAILED: 'Не удалось обработать команду пользователя /start',
    REGISTER_USER_ENTRY: 'registerUser',
    REGISTER_USER_EXIT: 'registerUser',
  },

  // Application Layer - Use Cases
  USE_CASES: {
    JOIN_GAME_PROCESSING: 'Обработка запроса на присоединение к игре',
    JOIN_GAME_COMPLETED: 'Присоединение к игре завершено успешно',
    REGISTER_USER_PROCESSING: 'Обработка запроса на регистрацию пользователя',
    REGISTER_USER_COMPLETED: 'Регистрация пользователя завершена успешно',
    REGISTER_USER_FAILED: 'Регистрация пользователя не удалась',
    REGISTER_ORGANIZER_PROCESSING: 'Обработка запроса на регистрацию организатора',
    REGISTER_ORGANIZER_COMPLETED: 'Регистрация организатора завершена успешно',
    REGISTER_ORGANIZER_FAILED: 'Регистрация организатора не удалась',
  },

  // Application Services
  SERVICES: {
    USER_SERVICE_INVOKE_REPO: 'Вызов операции репозитория пользователей',
    USER_SERVICE_REGISTER_COMPLETED: 'Регистрация пользователя завершена успешно',
    GAME_SERVICE_CREATE_START: 'Начало процесса создания игры',
    GAME_SERVICE_ORGANIZER_NOT_FOUND: 'Организатор не найден',
    GAME_SERVICE_VENUE_CONFLICT: 'Обнаружен конфликт площадок',
    GAME_SERVICE_CREATE_COMPLETED: 'Игра создана успешно',
  },

  // Infrastructure Layer - Repositories
  REPOSITORIES: {
    USER_UPSERT_COMPLETED: 'Операция upsert пользователя завершена успешно',
  },
} as const;

/**
 * Типы для ключей сообщений логирования
 * Обеспечивают типобезопасность при использовании констант
 */
export type LogMessageKey = keyof typeof LOG_MESSAGES;
export type BotLogKey = keyof typeof LOG_MESSAGES.BOT;
export type UseCaseLogKey = keyof typeof LOG_MESSAGES.USE_CASES;
export type ServiceLogKey = keyof typeof LOG_MESSAGES.SERVICES;
export type RepositoryLogKey = keyof typeof LOG_MESSAGES.REPOSITORIES;