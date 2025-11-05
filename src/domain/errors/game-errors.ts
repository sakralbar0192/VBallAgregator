import { BusinessRuleError } from './business-rule-error.js';
import { ERROR_CODES } from '../errors.js';

export class GameNotOpenError extends BusinessRuleError {
  constructor(gameId: string) {
    super(
      ERROR_CODES.GAME_NOT_OPEN,
      'Игра не открыта для записи',
      { gameId }
    );
  }
}

export class GameAlreadyStartedError extends BusinessRuleError {
  constructor(gameId: string, startsAt: Date) {
    super(
      ERROR_CODES.GAME_ALREADY_STARTED,
      'Игра уже началась',
      { gameId, startsAt }
    );
  }
}

export class CapacityReachedError extends BusinessRuleError {
  constructor(gameId: string, capacity: number, confirmedCount: number) {
    super(
      ERROR_CODES.CAPACITY_REACHED,
      'Достигнута максимальная вместимость',
      { gameId, capacity, confirmedCount }
    );
  }
}

export class AlreadyRegisteredError extends BusinessRuleError {
  constructor(gameId: string, userId: string) {
    super(
      ERROR_CODES.ALREADY_REGISTERED,
      'Вы уже зарегистрированы на эту игру',
      { gameId, userId }
    );
  }
}