import { describe, it, expect } from '@jest/globals';
import { InputValidator } from '../shared/input-validator.js';
import { ValidationError } from '../domain/errors/validation-error.js';

describe('InputValidator', () => {
  it('validateRequired', () => {
    InputValidator.validateRequired('a', 'f');
    expect(() => InputValidator.validateRequired('', 'f')).toThrow(ValidationError);
    expect(() => InputValidator.validateRequired(null, 'f')).toThrow(ValidationError);
  });

  it('validatePositiveNumber', () => {
    InputValidator.validatePositiveNumber(1, 'n');
    expect(() => InputValidator.validatePositiveNumber(0, 'n')).toThrow(ValidationError);
    expect(() => InputValidator.validatePositiveNumber(-1, 'n')).toThrow(ValidationError);
  });

  it('validateDate', () => {
    InputValidator.validateDate(new Date(), 'd');
    expect(() => InputValidator.validateDate(new Date('invalid'), 'd')).toThrow(ValidationError);
  });

  it('validateStringLength', () => {
    InputValidator.validateStringLength('ab', 's', 2, 3);
    expect(() => InputValidator.validateStringLength('a', 's', 2, 3)).toThrow(ValidationError);
  });

  it('validateEnum', () => {
    InputValidator.validateEnum('a', 'e', ['a', 'b']);
    expect(() => InputValidator.validateEnum('c', 'e', ['a', 'b'])).toThrow(ValidationError);
  });
});
