import {
  AbstractDomainError,
  ValidationError,
  BusinessRuleError,
  SystemError
} from '../domain/errors/index.js';
import { DomainError, ERROR_CODES } from '../domain/errors.js';

export class EnhancedErrorHandler {
  private static domainErrorMessages: Record<string, string> = {
    // Бизнес-правила
    [ERROR_CODES.GAME_NOT_OPEN]: 'Игра не открыта для записи',
    [ERROR_CODES.GAME_ALREADY_STARTED]: 'Игра уже началась',
    [ERROR_CODES.CAPACITY_REACHED]: 'Все места заняты',
    [ERROR_CODES.ALREADY_REGISTERED]: 'Вы уже зарегистрированы на эту игру',
    [ERROR_CODES.VENUE_OCCUPIED]: 'Площадка занята в это время',

    // Валидация
    [ERROR_CODES.INVALID_INPUT]: 'Некорректный ввод',
    [ERROR_CODES.MISSING_REQUIRED_FIELD]: 'Обязательное поле не заполнено',
    [ERROR_CODES.INVALID_FORMAT]: 'Некорректный формат данных',
    [ERROR_CODES.VALUE_OUT_OF_RANGE]: 'Значение вне допустимого диапазона',
    [ERROR_CODES.VALIDATION_FAILED]: 'Ошибка валидации',

    // Доступ
    [ERROR_CODES.NOT_FOUND]: 'Сущность не найдена',
    [ERROR_CODES.FORBIDDEN]: 'Доступ запрещен',
    [ERROR_CODES.UNAUTHORIZED]: 'Необходима авторизация',

    // Системные
    [ERROR_CODES.DATABASE_ERROR]: 'Ошибка базы данных',
    [ERROR_CODES.EXTERNAL_SERVICE_ERROR]: 'Ошибка внешнего сервиса',
    [ERROR_CODES.TIMEOUT_ERROR]: 'Превышено время ожидания',
    [ERROR_CODES.SYSTEM_ERROR]: 'Системная ошибка',
    [ERROR_CODES.INVALID_STATE]: 'Недопустимое состояние',

    // Устаревшие коды для обратной совместимости
    [ERROR_CODES.PAYMENT_WINDOW_NOT_OPEN]: 'Окно оплаты еще не открыто',
    [ERROR_CODES.NOT_CONFIRMED]: 'Только подтвержденные участники могут отмечать оплату',
    [ERROR_CODES.PRIORITY_WINDOW_ACTIVE]: 'Игра доступна только для подтвержденных игроков организатора в приоритетное окно',
  };

  static mapToUserMessage(error: Error): string {
    if (error instanceof AbstractDomainError) {
      return error.getUserMessage();
    }

    if (error instanceof DomainError) {
      return this.domainErrorMessages[error.code] || 'Неизвестная ошибка';
    }

    return 'Произошла ошибка. Попробуйте позже.';
  }

  static isRetryable(error: Error): boolean {
    if (error instanceof AbstractDomainError) {
      return error.isRetryable();
    }

    // Другие типы ошибок, которые можно повторить
    return error.name === 'TimeoutError' ||
           error.message.includes('ETIMEDOUT');
  }

  static shouldNotify(error: Error): boolean {
    // Уведомлять только о серьезных системных ошибках
    if (error instanceof SystemError) return true;
    if (error instanceof BusinessRuleError) return false;
    if (error instanceof ValidationError) return false;

    // Неожиданные ошибки
    return true;
  }
}

// Обратная совместимость
export const ErrorHandler = EnhancedErrorHandler;