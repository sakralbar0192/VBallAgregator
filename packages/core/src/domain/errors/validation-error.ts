import { AbstractDomainError } from './abstract-domain-error.js';

export class ValidationError extends AbstractDomainError {
  constructor(field: string, value: any, rule: string) {
    super(
      `Validation failed for ${field}: ${rule}`,
      'VALIDATION_FAILED',
      { field, value, rule }
    );
  }

  getUserMessage(): string {
    return `Некорректные данные: ${this.context.field}`;
  }

  isRetryable(): boolean {
    return false; // Пользователь должен исправить данные
  }
}