// Статусы игры в жизненном цикле
export enum GameStatus {
  open = 'open', // Открыта для записи
  closed = 'closed', // Запись закрыта
  finished = 'finished', // Игра завершена
  canceled = 'canceled' // Игра отменена
}

import { DomainError, ERROR_CODES } from './errors.js';

// Доменная сущность "Игра" - Aggregate Root
export class Game {
  constructor(
    readonly id: string, // Уникальный идентификатор игры
    readonly organizerId: string, // ID организатора
    readonly venueId: string, // ID площадки
    public startsAt: Date, // Время начала игры
    public capacity: number, // Максимальное количество участников
    public levelTag?: string, // Уровень игры (новичок/любитель/профи)
    public priceText?: string, // Стоимость участия
    public status: GameStatus = GameStatus.open, // Текущий статус
  ) {}

  // Проверяет, открыто ли окно оплаты (после начала игры)
  get isPaymentWindowOpen(): boolean {
    return new Date() >= this.startsAt && (this.status === GameStatus.open || this.status === GameStatus.finished);
  }

  // Бизнес-правило: проверка возможности записи на игру
  ensureCanJoin(confirmedCount: number) {
    if (this.status !== GameStatus.open) throw new DomainError(ERROR_CODES.GAME_NOT_OPEN, 'Игра не открыта для записи');
    if (this.startsAt <= new Date()) throw new DomainError(ERROR_CODES.GAME_ALREADY_STARTED, 'Игра уже началась');
    if (confirmedCount >= this.capacity) throw new DomainError(ERROR_CODES.CAPACITY_REACHED, 'Достигнута максимальная вместимость');
  }

  // Методы изменения статуса игры
  close() { this.status = GameStatus.closed; }
  finish() { this.status = GameStatus.finished; }
  cancel() { this.status = GameStatus.canceled; }
}