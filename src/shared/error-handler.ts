import { DomainError, ERROR_CODES } from '../domain/errors.js';

export class ErrorHandler {
  private static domainErrorMessages: Record<string, string> = {
    [ERROR_CODES.GAME_NOT_OPEN]: 'Игра не открыта для записи',
    [ERROR_CODES.GAME_ALREADY_STARTED]: 'Игра уже началась',
    [ERROR_CODES.CAPACITY_REACHED]: 'Все места заняты',
    [ERROR_CODES.NOT_FOUND]: 'Игра не найдена',
    [ERROR_CODES.PAYMENT_WINDOW_NOT_OPEN]: 'Окно оплаты еще не открыто',
    [ERROR_CODES.NOT_CONFIRMED]: 'Только подтвержденные участники могут отмечать оплату',
    [ERROR_CODES.PRIORITY_WINDOW_ACTIVE]: 'Игра доступна только для подтвержденных игроков организатора в приоритетное окно',
    [ERROR_CODES.FORBIDDEN]: 'Доступ запрещен',
    [ERROR_CODES.INVALID_STATE]: 'Недопустимое состояние',
    [ERROR_CODES.INVALID_INPUT]: 'Некорректный ввод',
  };

  static mapToUserMessage(error: Error): string {
    if (error instanceof DomainError) {
      return this.domainErrorMessages[error.code] || 'Неизвестная ошибка';
    }
    return 'Произошла ошибка. Попробуй позже.';
  }
}