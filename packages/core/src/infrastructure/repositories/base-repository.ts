import { prisma } from '../prisma.js';
import { LoggerFactory } from '../../shared/layer-logger.js';
import { InputValidator } from '../../shared/input-validator.js';

/**
 * Базовый класс для всех репозиториев Prisma
 * Предоставляет общие методы логирования, валидации и транзакций
 */
export abstract class BasePrismaRepository {
  protected readonly logger;

  constructor(component: string) {
    this.logger = LoggerFactory.repository(component);
  }

  /**
   * Выполняет функцию в транзакции Prisma.
   * Используется для обеспечения ACID-свойств при операциях с несколькими таблицами.
   * @param fn - Функция, выполняемая в транзакции
   * @returns Результат выполнения функции
   */
  protected async transaction<T>(fn: () => Promise<T>): Promise<T> {
    return prisma.$transaction(fn);
  }

  /**
   * Выполняет операцию с логированием и обработкой ошибок
   * @param operation - Название операции
   * @param table - Название таблицы
   * @param action - Действие (SELECT, INSERT, UPDATE, DELETE)
   * @param params - Параметры операции
   * @param fn - Функция операции
   * @returns Результат выполнения операции
   */
  protected async executeWithLogging<T>(
    operation: string,
    table: string,
    action: string,
    params: any,
    fn: () => Promise<T>
  ): Promise<T> {
    this.logger.database(operation, table, action, params);

    try {
      const result = await fn();
      this.logger.info(operation, `${action} успешно завершено`, params);
      return result;
    } catch (error) {
      this.logger.error(operation, `Ошибка при выполнении ${action.toLowerCase()}`, error as Error, params);
      throw error;
    }
  }

  /**
   * Валидирует обязательный параметр
   * @param value - Значение для проверки
   * @param fieldName - Название поля
   */
  protected validateRequired(value: any, fieldName: string): void {
    InputValidator.validateRequired(value, fieldName);
  }

  /**
   * Валидирует положительное число
   * @param value - Число для проверки
   * @param fieldName - Название поля
   */
  protected validatePositiveNumber(value: number, fieldName: string): void {
    InputValidator.validatePositiveNumber(value, fieldName);
  }

  /**
   * Валидирует дату
   * @param value - Дата для проверки
   * @param fieldName - Название поля
   */
  protected validateDate(value: Date, fieldName: string): void {
    InputValidator.validateDate(value, fieldName);
  }

  /**
   * Валидирует длину строки
   * @param value - Строка для проверки
   * @param fieldName - Название поля
   * @param min - Минимальная длина
   * @param max - Максимальная длина
   */
  protected validateStringLength(value: string, fieldName: string, min: number = 1, max: number = 1000): void {
    InputValidator.validateStringLength(value, fieldName, min, max);
  }

  /**
   * Валидирует значение из списка допустимых
   * @param value - Значение для проверки
   * @param fieldName - Название поля
   * @param allowedValues - Допустимые значения
   */
  protected validateEnum<T>(value: T, fieldName: string, allowedValues: T[]): void {
    InputValidator.validateEnum(value, fieldName, allowedValues);
  }
}