import { AbstractDomainError } from './abstract-domain-error.js';
import { ErrorHandler } from '../../shared/error-handler.js';
export class BusinessRuleError extends AbstractDomainError {
  constructor(code: string, message: string, context: Record<string, any> = {}) {
    super(message, code, context);
  }

  getUserMessage(): string {
    // Используем ErrorHandler для маппинга сообщений
    return ErrorHandler.mapToUserMessage(this);
  }

  isRetryable(): boolean {
    return false; // Бизнес-правила не меняются
  }
}