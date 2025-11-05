import { ValidationError } from '../domain/errors/validation-error.js';

export class InputValidator {
  static validateRequired(value: any, fieldName: string): void {
    if (value === null || value === undefined ||
        (typeof value === 'string' && !value.trim())) {
      throw new ValidationError(fieldName, value, 'required');
    }
  }

  static validatePositiveNumber(value: number, fieldName: string): void {
    if (typeof value !== 'number' || value <= 0) {
      throw new ValidationError(fieldName, value, 'positive_number');
    }
  }

  static validateDate(value: Date, fieldName: string): void {
    if (!(value instanceof Date) || isNaN(value.getTime())) {
      throw new ValidationError(fieldName, value, 'valid_date');
    }
  }

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

  static validateEnum<T>(value: T, fieldName: string, allowedValues: T[]): void {
    if (!allowedValues.includes(value)) {
      throw new ValidationError(fieldName, value, 'enum');
    }
  }
}