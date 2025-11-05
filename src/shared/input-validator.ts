import { ValidationError } from '../domain/errors/validation-error.js';

export class InputValidator {
  /**
   * Проверяет, что значение не является пустым (null, undefined или пустой строкой)
   *
   * @param value - Значение для проверки
   * @param fieldName - Название поля для включения в сообщение об ошибке
   * @throws {ValidationError} Выбрасывается, если значение пустое
   */
  static validateRequired(value: any, fieldName: string): void {
    if (value === null || value === undefined ||
        (typeof value === 'string' && !value.trim())) {
      throw new ValidationError(fieldName, value, 'required');
    }
  }

  /**
   * Проверяет, что число является положительным
   *
   * @param value - Число для проверки
   * @param fieldName - Название поля для включения в сообщение об ошибке
   * @throws {ValidationError} Выбрасывается, если число не положительное
   */
  static validatePositiveNumber(value: number, fieldName: string): void {
    if (typeof value !== 'number' || value <= 0) {
      throw new ValidationError(fieldName, value, 'positive_number');
    }
  }

  /**
   * Проверяет, что значение является корректной датой
   *
   * @param value - Объект Date для проверки
   * @param fieldName - Название поля для включения в сообщение об ошибке
   * @throws {ValidationError} Выбрасывается, если дата некорректна
   */
  static validateDate(value: Date, fieldName: string): void {
    if (!(value instanceof Date) || isNaN(value.getTime())) {
      throw new ValidationError(fieldName, value, 'valid_date');
    }
  }

  /**
   * Проверяет, что длина строки находится в заданных пределах
   *
   * @param value - Строка для проверки
   * @param fieldName - Название поля для включения в сообщение об ошибке
   * @param min - Минимальная допустимая длина (по умолчанию 1)
   * @param max - Максимальная допустимая длина (по умолчанию 1000)
   * @throws {ValidationError} Выбрасывается, если длина строки вне пределов
   */
  static validateStringLength(
    value: string,
    fieldName: string,
    min: number = 1,
    max: number = 1000
  ): void {
    if (value.length < min || value.length > max) {
      throw new ValidationError(fieldName, value, `length_${min}_${max}`);
    }
  }

  /**
   * Проверяет, что значение находится в списке допустимых значений
   *
   * @param value - Значение для проверки
   * @param fieldName - Название поля для включения в сообщение об ошибке
   * @param allowedValues - Массив допустимых значений
   * @throws {ValidationError} Выбрасывается, если значение не входит в список допустимых
   */
  static validateEnum<T>(value: T, fieldName: string, allowedValues: T[]): void {
    if (!allowedValues.includes(value)) {
      throw new ValidationError(fieldName, value, 'enum');
    }
  }
}