import { AbstractDomainError } from './abstract-domain-error.js';

export class SystemError extends AbstractDomainError {
  constructor(message: string, context: Record<string, any> = {}) {
    super(message, 'SYSTEM_ERROR', context);
  }

  getUserMessage(): string {
    return 'Произошла системная ошибка. Попробуйте позже.';
  }

  isRetryable(): boolean {
    return true; // Можно повторить запрос
  }
}