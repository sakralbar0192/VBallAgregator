// Доменная ошибка для бизнес-правил
export class DomainError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

// Коды ошибок доменной логики
export const ERROR_CODES = {
  GAME_NOT_OPEN: 'GAME_NOT_OPEN', // Игра не открыта для записи
  GAME_ALREADY_STARTED: 'GAME_ALREADY_STARTED', // Игра уже началась
  CAPACITY_REACHED: 'CAPACITY_REACHED', // Достигнута максимальная вместимость
  NOT_FOUND: 'NOT_FOUND', // Сущность не найдена
  PAYMENT_WINDOW_NOT_OPEN: 'PAYMENT_WINDOW_NOT_OPEN', // Окно оплаты еще не открыто
  NOT_CONFIRMED: 'NOT_CONFIRMED', // Только подтвержденные участники могут отмечать оплату
  PRIORITY_WINDOW_ACTIVE: 'PRIORITY_WINDOW_ACTIVE', // Игра доступна только для подтвержденных игроков организатора в приоритетное окно
  FORBIDDEN: 'FORBIDDEN', // Доступ запрещен
  INVALID_STATE: 'INVALID_STATE', // Недопустимое состояние
  INVALID_INPUT: 'INVALID_INPUT', // Некорректный ввод
} as const;