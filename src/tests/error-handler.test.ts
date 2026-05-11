import { describe, it, expect } from '@jest/globals';
import { ErrorHandler } from '../shared/error-handler.js';
import { ValidationError } from '../domain/errors/validation-error.js';
import { SystemError } from '../domain/errors/system-error.js';
import { DomainError, ERROR_CODES } from '../domain/errors.js';

describe('ErrorHandler', () => {
  it('maps DomainError and fallback', () => {
    expect(ErrorHandler.mapToUserMessage(new DomainError(ERROR_CODES.NOT_FOUND, 'x'))).toContain('найден');
    expect(ErrorHandler.mapToUserMessage(new Error('plain'))).toContain('Произошла ошибка');
  });

  it('isRetryable and shouldNotify', () => {
    expect(ErrorHandler.isRetryable(new Error('ETIMEDOUT'))).toBe(true);
    expect(ErrorHandler.shouldNotify(new SystemError('x'))).toBe(true);
    expect(ErrorHandler.shouldNotify(new ValidationError('f', 'v', 't'))).toBe(false);
  });
});
