// Устаревший класс - оставлен для обратной совместимости
// Рекомендуется использовать специализированные классы ошибок из ./errors/
export class DomainError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

// Коды ошибок доменной логики с категоризацией
export const ERROR_CODES = {
  // Бизнес-правила
  GAME_NOT_OPEN: 'GAME_NOT_OPEN',
  GAME_ALREADY_STARTED: 'GAME_ALREADY_STARTED',
  CAPACITY_REACHED: 'CAPACITY_REACHED',
  ALREADY_REGISTERED: 'ALREADY_REGISTERED',
  PAYMENT_WINDOW_NOT_OPEN: 'PAYMENT_WINDOW_NOT_OPEN',
  NOT_CONFIRMED: 'NOT_CONFIRMED',
  PRIORITY_WINDOW_ACTIVE: 'PRIORITY_WINDOW_ACTIVE',
  VENUE_OCCUPIED: 'VENUE_OCCUPIED',

  // Валидация
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',
  VALUE_OUT_OF_RANGE: 'VALUE_OUT_OF_RANGE',
  VALIDATION_FAILED: 'VALIDATION_FAILED',

  // Доступ
  FORBIDDEN: 'FORBIDDEN',
  UNAUTHORIZED: 'UNAUTHORIZED',
  NOT_FOUND: 'NOT_FOUND',

  // Системные
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  SYSTEM_ERROR: 'SYSTEM_ERROR',
  INVALID_STATE: 'INVALID_STATE',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];