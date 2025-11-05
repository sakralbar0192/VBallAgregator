# Оценка использования DomainError на проекте VBallAgregator

## 📋 Анализ текущего состояния

### ✅ Сильные стороны
- **Правильная доменная модель**: DomainError используется в бизнес-логике (игры, регистрации)
- **Централизованные коды**: ERROR_CODES обеспечивает единообразие
- **Базовый ErrorHandler**: Есть маппинг на пользовательские сообщения
- **Четкое разделение**: Доменные ошибки отделены от технических

### ❌ Выявленные проблемы

#### 1. **Несоответствие кодов ошибок**
```typescript
// В game-domain-service.ts:44 используется
throw new DomainError('ALREADY_REGISTERED', '...');
// Но ALREADY_REGISTERED отсутствует в ERROR_CODES!
```

#### 2. **Дублирование валидации**
```typescript
// Повторяется в каждом use case (14+ раз)
if (!gameId?.trim()) {
  throw new DomainError('INVALID_INPUT', 'gameId не может быть пустым');
}
```

#### 3. **Плоская структура**
Все ошибки имеют одинаковый приоритет, нет категоризации по:
- Бизнес-правилам
- Валидации входных данных  
- Системным ошибкам
- Авторизации/доступу

#### 4. **Ограниченная обработка в боте**
Bot использует только общий `bot.catch()`, не различает:
- Исправимые пользователем ошибки
- Временные системные проблемы
- Неисправимые ошибки

#### 5. **Отсутствие контекста**
Нет возможности добавить:
- Correlation ID для трассировки
- Дополнительные метаданные
- Исходные данные ошибки

## 🎯 Рекомендации по улучшению

### 1. **Иерархия специализированных ошибок**

```typescript
// src/domain/errors/abstract-domain-error.ts
export abstract class AbstractDomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context: Record<string, any> = {}
  ) {
    super(message);
    this.name = this.constructor.name;
  }
  
  abstract getUserMessage(): string;
  abstract isRetryable(): boolean;
}

// src/domain/errors/validation-error.ts
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

// src/domain/errors/business-rule-error.ts  
export class BusinessRuleError extends AbstractDomainError {
  constructor(code: string, message: string, context: Record<string, any> = {}) {
    super(message, code, context);
  }
  
  getUserMessage(): string {
    return ErrorHandler.mapToUserMessage(this);
  }
  
  isRetryable(): boolean {
    return false; // Бизнес-правила не меняются
  }
}

// src/domain/errors/system-error.ts
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
```

### 2. **Обновление ERROR_CODES**

```typescript
// src/domain/errors/error-codes.ts
export const ERROR_CODES = {
  // Бизнес-правила
  GAME_NOT_OPEN: 'GAME_NOT_OPEN',
  GAME_ALREADY_STARTED: 'GAME_ALREADY_STARTED', 
  CAPACITY_REACHED: 'CAPACITY_REACHED',
  ALREADY_REGISTERED: 'ALREADY_REGISTERED',
  PAYMENT_WINDOW_NOT_OPEN: 'PAYMENT_WINDOW_NOT_OPEN',
  NOT_CONFIRMED: 'NOT_CONFIRMED',
  PRIORITY_WINDOW_ACTIVE: 'PRIORITY_WINDOW_ACTIVE',
  VENUE_OCCUPIED: 'VENUE_OCCUPIED',
  
  // Валидация
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',
  VALUE_OUT_OF_RANGE: 'VALUE_OUT_OF_RANGE',
  
  // Доступ
  FORBIDDEN: 'FORBIDDEN',
  UNAUTHORIZED: 'UNAUTHORIZED',
  NOT_FOUND: 'NOT_FOUND',
  
  // Системные
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR'
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];
```

### 3. **Специализированные ошибки домена**

```typescript
// src/domain/errors/game-errors.ts
import { BusinessRuleError } from './business-rule-error.js';
import { ERROR_CODES } from './error-codes.js';

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
```

### 4. **Улучшенный ErrorHandler**

```typescript
// src/shared/error-handler.ts
import { 
  AbstractDomainError, 
  ValidationError, 
  BusinessRuleError, 
  SystemError 
} from '../domain/errors/index.js';

export class EnhancedErrorHandler {
  private static domainErrorMessages: Record<string, string> = {
    // Бизнес-правила
    [ERROR_CODES.GAME_NOT_OPEN]: 'Игра не открыта для записи',
    [ERROR_CODES.GAME_ALREADY_STARTED]: 'Игра уже началась',
    [ERROR_CODES.CAPACITY_REACHED]: 'Все места заняты',
    [ERROR_CODES.ALREADY_REGISTERED]: 'Вы уже зарегистрированы на эту игру',
    [ERROR_CODES.VENUE_OCCUPIED]: 'Площадка занята в это время',
    
    // Валидация
    [ERROR_CODES.INVALID_INPUT]: 'Некорректный ввод',
    [ERROR_CODES.MISSING_REQUIRED_FIELD]: 'Обязательное поле не заполнено',
    [ERROR_CODES.INVALID_FORMAT]: 'Некорректный формат данных',
    [ERROR_CODES.VALUE_OUT_OF_RANGE]: 'Значение вне допустимого диапазона',
    
    // Доступ
    [ERROR_CODES.NOT_FOUND]: 'Сущность не найдена',
    [ERROR_CODES.FORBIDDEN]: 'Доступ запрещен',
    [ERROR_CODES.UNAUTHORIZED]: 'Необходима авторизация',
    
    // Системные
    [ERROR_CODES.DATABASE_ERROR]: 'Ошибка базы данных',
    [ERROR_CODES.EXTERNAL_SERVICE_ERROR]: 'Ошибка внешнего сервиса',
    [ERROR_CODES.TIMEOUT_ERROR]: 'Превышено время ожидания'
  };
  
  static mapToUserMessage(error: Error): string {
    if (error instanceof AbstractDomainError) {
      return error.getUserMessage();
    }
    
    if (error instanceof DomainError) {
      return this.domainErrorMessages[error.code] || 'Неизвестная ошибка';
    }
    
    return 'Произошла ошибка. Попробуйте позже.';
  }
  
  static isRetryable(error: Error): boolean {
    if (error instanceof AbstractDomainError) {
      return error.isRetryable();
    }
    
    // Другие типы ошибок, которые можно повторить
    return error.name === 'TimeoutError' || 
           error.message.includes('ETIMEDOUT');
  }
  
  static shouldNotify(error: Error): boolean {
    // Уведомлять только о серьезных системных ошибках
    if (error instanceof SystemError) return true;
    if (error instanceof BusinessRuleError) return false;
    if (error instanceof ValidationError) return false;
    
    // Неожиданные ошибки
    return true;
  }
}
```

### 5. **Валидатор входных данных**

```typescript
// src/shared/input-validator.ts
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
```

### 6. **Улучшенные Use Cases**

```typescript
// src/application/use-cases.ts
import { InputValidator } from '../shared/input-validator.js';
import { 
  GameNotOpenError, 
  GameAlreadyStartedError, 
  CapacityReachedError,
  AlreadyRegisteredError 
} from '../domain/errors/game-errors.js';

export async function joinGame(gameId: string, userId: string) {
  // Валидация входных данных
  InputValidator.validateRequired(gameId, 'gameId');
  InputValidator.validateRequired(userId, 'userId');
  
  // ... остальная логика
  
  // Бизнес-правила
  const existing = await registrationRepo.get(gameId, userId);
  if (existing && existing.status === RegStatus.confirmed) {
    throw new AlreadyRegisteredError(gameId, userId);
  }
  
  if (confirmedCount >= game.capacity) {
    throw new CapacityReachedError(gameId, game.capacity, confirmedCount);
  }
}
```

### 7. **Улучшенная обработка в боте**

```typescript
// src/bot.ts - улучшенный обработчик ошибок
bot.catch((err, ctx) => {
  const correlationId = `bot_${ctx.from.id}_${Date.now()}`;
  
  if (err instanceof ValidationError) {
    // Ошибки валидации - показываем пользователю что исправить
    return ctx.reply(
      `❌ ${err.getUserMessage()}\n\n` +
      `Исправьте данные и попробуйте снова.`,
      { parse_mode: 'Markdown' }
    );
  }
  
  if (err instanceof BusinessRuleError) {
    // Ошибки бизнес-правил - объясняем почему нельзя
    return ctx.reply(`❌ ${err.getUserMessage()}`);
  }
  
  if (err instanceof SystemError) {
    // Системные ошибки - предлагаем повторить
    return ctx.reply(
      `⚠️ ${err.getUserMessage()}\n\n` +
      `Попробуйте повторить операцию через несколько минут.`
    );
  }
  
  // Неожиданные ошибки - логируем и показываем generic сообщение
  console.error('Bot error:', err, { correlationId, ctx: ctx.update });
  return ctx.reply('Произошла неожиданная ошибка. Попробуйте позже.');
});
```

## 📈 Ожидаемые преимущества

### 1. **Для разработчиков**
- ✅ Четкое разделение типов ошибок
- ✅ Контекстная информация в ошибках  
- ✅ Централизованная валидация
- ✅ Лучшая трассировка через correlation IDs

### 2. **Для пользователей**
- ✅ Понятные сообщения об ошибках
- ✅ Конкретные инструкции по исправлению
- ✅ Различение исправимых и неисправимых ошибок

### 3. **Для системы**
- ✅ Улучшенная observability
- ✅ Автоматическое retry для подходящих ошибок
- ✅ Точные алерты для критических проблем

## 🔧 План внедрения

### Этап 1 (1-2 дня)
1. Создать новую иерархию ошибок
2. Добавить недостающие коды в ERROR_CODES
3. Реализовать InputValidator

### Этап 2 (2-3 дня) 
1. Обновить доменные сущности и сервисы
2. Рефакторить use cases с новыми типами ошибок
3. Обновить ErrorHandler

### Этап 3 (1 день)
1. Улучшить обработку ошибок в боте
2. Добавить correlation IDs для трассировки
3. Протестировать все сценарии

## 📊 Метрики успеха

- **Количество строк кода валидации**: -60%
- **Время разработки новых функций**: -30%
- **Жалобы пользователей на ошибки**: -40%
- **Время диагностики проблем**: -50%