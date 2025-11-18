# Руководство по внедрению EnhancedConsoleLogger

## Обзор

Этот документ содержит практические рекомендации по внедрению и оптимизации системы логирования `EnhancedConsoleLogger` в проекте VBallAgregator.

---

## 1. Текущее состояние

### 1.1 Что уже реализовано

✅ **Базовая система логирования**
- [`EnhancedConsoleLogger`](../src/shared/enhanced-logger.ts) — основной класс
- [`LayerLogger`](../src/shared/layer-logger.ts) — специализированный логгер по слоям
- [`LoggerFactory`](../src/shared/layer-logger.ts:398) — фабрика для создания логгеров

✅ **Архитектурные слои**
- PRESENTATION (Bot Handlers)
- APPLICATION (Use Cases & Services)
- DOMAIN (Business Logic)
- INFRASTRUCTURE (Repositories & External Services)
- CROSS_CUTTING (Events, Notifications)

✅ **Использование в проекте**
- 67 точек использования LoggerFactory
- Все основные компоненты логируют операции
- Корреляционные ID используются для трассировки

### 1.2 Что нужно улучшить

⚠️ **Интеграция с внешними системами**
- Заглушка `sendToExternalService()` требует реализации
- Нет интеграции с системами мониторинга (CloudWatch, DataDog, Sentry)

⚠️ **Стандартизация**
- Некоторые компоненты могут использовать разные форматы корреляционных ID
- Не все операции логируют время выполнения

⚠️ **Документирование**
- Отсутствуют примеры для новых разработчиков
- Нет чек-листа для миграции компонентов

---

## 2. Фазы внедрения

### Фаза 1: Стандартизация (1-2 недели)

**Цель:** Унифицировать использование логгера во всех компонентах

#### 2.1.1 Стандартизация корреляционных ID

**Текущее состояние:**
```typescript
// Разные форматы в разных местах
const correlationId = `register_${telegramId}_${Date.now()}`;
const correlationId = `join_${userId}_${gameId}_${Date.now()}`;
const correlationId = `create_game_${data.organizerId}_${Date.now()}`;
```

**Рекомендация:** Создать утилиту для генерации

```typescript
// src/shared/correlation-id-generator.ts
export function generateCorrelationId(operation: string, ...identifiers: (string | number)[]): string {
  const id = identifiers.filter(Boolean).join('_');
  return `${operation}_${id}_${Date.now()}`;
}

// Использование
const correlationId = generateCorrelationId('register', telegramId);
const correlationId = generateCorrelationId('join', userId, gameId);
const correlationId = generateCorrelationId('create_game', organizerId);
```

#### 2.1.2 Стандартизация метаданных

**Создать типы для метаданных:**

```typescript
// src/shared/logger-types.ts
export interface UserMetadata {
  telegramId?: number;
  userId?: string;
  firstName?: string;
  lastName?: string;
}

export interface GameMetadata {
  gameId?: string;
  organizerId?: string;
  playerCount?: number;
  status?: string;
}

export interface OperationMetadata extends UserMetadata, GameMetadata {
  [key: string]: any;
}

export interface OperationContext {
  correlationId: string;
  telegramId?: number;
  userId?: string;
  gameId?: string;
  executionTimeMs?: number;
}
```

#### 2.1.3 Чек-лист стандартизации

```markdown
- [ ] Создать утилиту для генерации корреляционных ID
- [ ] Определить типы для метаданных
- [ ] Обновить все use cases для использования новой утилиты
- [ ] Обновить все сервисы для использования типизированных метаданных
- [ ] Добавить логирование времени выполнения в репозитории
- [ ] Протестировать логирование в разработке
```

---

### Фаза 2: Интеграция с внешними системами (2-3 недели)

**Цель:** Настроить отправку логов в систему мониторинга

#### 2.2.1 Выбор системы мониторинга

**Рекомендация для VBallAgregator:** Sentry или CloudWatch

| Критерий | Sentry | CloudWatch | DataDog |
|----------|--------|-----------|---------|
| **Простота** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| **Стоимость** | Бесплатно (до 5k ошибок) | Платно | Платно |
| **Отслеживание ошибок** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Аналитика** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Интеграция** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

**Рекомендация:** Начать с Sentry (простая интеграция, бесплатный план достаточен для MVP)

#### 2.2.2 Интеграция с Sentry

**Установка:**
```bash
npm install @sentry/node
```

**Реализация:**
```typescript
// src/shared/enhanced-logger.ts
import * as Sentry from '@sentry/node';

export class EnhancedConsoleLogger implements Logger {
  private sendToExternalService(entry: StructuredLog): void {
    if (process.env.SENTRY_DSN) {
      Sentry.captureException(new Error(entry.message), {
        level: entry.level.toLowerCase() as SeverityLevel,
        tags: {
          layer: entry.layer,
          component: entry.component,
          operation: entry.operation
        },
        contexts: {
          log: {
            correlationId: entry.correlationId,
            metadata: entry.metadata
          }
        }
      });
    }
  }
}
```

**Инициализация в index.ts:**
```typescript
import * as Sentry from '@sentry/node';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 1.0,
  });
}
```

#### 2.2.3 Переменные окружения

```bash
# .env.production
SENTRY_DSN=https://your-key@sentry.io/your-project-id
NODE_ENV=production

# .env.development
NODE_ENV=development
```

#### 2.2.4 Чек-лист интеграции

```markdown
- [ ] Выбрать систему мониторинга (Sentry)
- [ ] Установить зависимости
- [ ] Реализовать sendToExternalService()
- [ ] Добавить переменные окружения
- [ ] Протестировать отправку ошибок
- [ ] Настроить уведомления в Sentry
- [ ] Документировать процесс
```

---

### Фаза 3: Оптимизация и мониторинг (2-3 недели)

**Цель:** Настроить мониторинг производительности и аналитику

#### 2.3.1 Метрики производительности

**Создать сборщик метрик:**

```typescript
// src/shared/logger-metrics.ts
export class LoggerMetrics {
  private static operationTimes: Map<string, number[]> = new Map();

  static recordOperation(operation: string, duration: number): void {
    if (!this.operationTimes.has(operation)) {
      this.operationTimes.set(operation, []);
    }
    this.operationTimes.get(operation)!.push(duration);
  }

  static getStats(operation: string) {
    const times = this.operationTimes.get(operation) || [];
    if (times.length === 0) return null;

    const sorted = [...times].sort((a, b) => a - b);
    const sum = times.reduce((a, b) => a + b, 0);

    return {
      count: times.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: Math.round(sum / times.length),
      p95: sorted[Math.floor(times.length * 0.95)],
      p99: sorted[Math.floor(times.length * 0.99)]
    };
  }

  static printReport(): void {
    console.log('\n=== Logger Metrics Report ===');
    for (const [operation, _] of this.operationTimes) {
      const stats = this.getStats(operation);
      console.log(`\n${operation}:`);
      console.log(`  Count: ${stats?.count}`);
      console.log(`  Min: ${stats?.min}ms`);
      console.log(`  Max: ${stats?.max}ms`);
      console.log(`  Avg: ${stats?.avg}ms`);
      console.log(`  P95: ${stats?.p95}ms`);
      console.log(`  P99: ${stats?.p99}ms`);
    }
  }
}
```

#### 2.3.2 Дашборд в Sentry

**Создать дашборд для отслеживания:**
- Количество ошибок по слоям
- Время выполнения операций
- Тренды по дням/неделям
- Критичные операции

#### 2.3.3 Алерты

**Настроить алерты для:**
- Более 10 ошибок в час
- Операция выполняется дольше 5 секунд
- Критичные операции (регистрация, платежи)

#### 2.3.4 Чек-лист оптимизации

```markdown
- [ ] Создать сборщик метрик
- [ ] Интегрировать метрики с Sentry
- [ ] Создать дашборд
- [ ] Настроить алерты
- [ ] Документировать метрики
- [ ] Проводить еженедельный анализ
```

---

## 3. Практические рекомендации

### 3.1 Логирование критичных операций

**Всегда логируйте:**
- Регистрация пользователей
- Создание игр
- Присоединение к игре
- Обработка платежей
- Отправка уведомлений
- Ошибки и исключения

**Пример:**
```typescript
export async function registerUser(telegramId: number, name: string) {
  const logger = LoggerFactory.useCase('registerUser');
  const correlationId = generateCorrelationId('register', telegramId);

  logger.info('registerUser', 'Processing registration',
    { telegramId, name },
    { correlationId, telegramId }
  );

  try {
    const user = await userService.registerUser({ telegramId, name });
    
    logger.info('registerUser', 'User registered successfully',
      { userId: user.id },
      { correlationId }
    );
    
    return user;
  } catch (error) {
    logger.error('registerUser', 'Registration failed',
      error as Error,
      { telegramId, errorMessage: (error as Error).message },
      { correlationId }
    );
    throw error;
  }
}
```

### 3.2 Логирование в обработчиках ошибок

**Создать глобальный обработчик ошибок:**

```typescript
// src/shared/error-handler.ts
import { LoggerFactory } from './layer-logger.js';

const errorLogger = LoggerFactory.external('error-handler');

export function handleError(error: Error, context?: Record<string, any>): void {
  errorLogger.error('unhandledError', 'Unhandled error occurred',
    error,
    { ...context, errorType: error.constructor.name }
  );

  // Отправить в Sentry
  if (process.env.NODE_ENV === 'production') {
    Sentry.captureException(error, { contexts: { error: context } });
  }
}

// Использование в bot.ts
bot.catch((error, ctx) => {
  handleError(error, {
    telegramId: ctx.from?.id,
    command: ctx.message?.text,
    updateId: ctx.update.update_id
  });
});
```

### 3.3 Логирование асинхронных операций

**Использовать logOperation() для автоматического отслеживания:**

```typescript
const result = await logger.logOperation(
  'joinGame',
  async () => {
    return await gameService.joinGame(playerId, gameId);
  },
  { correlationId },
  { playerId, gameId }
);
```

### 3.4 Логирование в тестах

**Отключить логирование в тестах:**

```typescript
// src/tests/setup.ts
import { enhancedLogger } from '../shared/enhanced-logger.js';

// Mock логгер для тестов
jest.mock('../shared/enhanced-logger.js', () => ({
  enhancedLogger: {
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));
```

---

## 4. Миграция существующего кода

### 4.1 Приоритизация компонентов

**Приоритет 1 (Критичные, неделя 1-2):**
- ✅ Bot handlers (уже мигрированы)
- ✅ Use cases (уже мигрированы)
- ✅ User service (уже мигрирована)
- ✅ Game service (уже мигрирована)

**Приоритет 2 (Важные, неделя 3-4):**
- [ ] Все репозитории (добавить логирование времени выполнения)
- [ ] Все сервисы приложения (стандартизировать метаданные)
- [ ] Event handlers (добавить корреляционные ID)

**Приоритет 3 (Вспомогательные, неделя 5-6):**
- [ ] Notification service
- [ ] Scheduler service
- [ ] Rate limiter
- [ ] Input validator

### 4.2 Шаблон миграции компонента

```typescript
// БЫЛО:
export class MyComponent {
  async doSomething(data: Data) {
    console.log('Starting operation');
    try {
      const result = await operation(data);
      console.log('Operation completed', result);
      return result;
    } catch (error) {
      console.error('Operation failed', error);
      throw error;
    }
  }
}

// СТАЛО:
import { LoggerFactory } from '../../shared/layer-logger.js';

export class MyComponent {
  private logger = LoggerFactory.service('my-component');

  async doSomething(data: Data) {
    const correlationId = generateCorrelationId('doSomething', data.id);
    
    this.logger.info('doSomething', 'Starting operation',
      { dataId: data.id },
      { correlationId }
    );

    try {
      const result = await operation(data);
      
      this.logger.info('doSomething', 'Operation completed',
        { resultId: result.id },
        { correlationId }
      );
      
      return result;
    } catch (error) {
      this.logger.error('doSomething', 'Operation failed',
        error as Error,
        { dataId: data.id },
        { correlationId }
      );
      throw error;
    }
  }
}
```

### 4.3 Чек-лист миграции компонента

```markdown
## Миграция компонента: [ComponentName]

- [ ] Заменить console.log на logger.info
- [ ] Заменить console.error на logger.error
- [ ] Добавить корреляционный ID для операции
- [ ] Логировать начало операции (entry)
- [ ] Логировать конец операции (exit)
- [ ] Добавить метаданные (userId, gameId, etc.)
- [ ] Логировать ошибки с полным контекстом
- [ ] Добавить логирование времени выполнения
- [ ] Протестировать логирование в разработке
- [ ] Проверить формат логов
- [ ] Обновить документацию компонента
- [ ] Создать PR с описанием изменений
```

---

## 5. Мониторинг и поддержка

### 5.1 Еженедельный анализ логов

**Каждый понедельник:**
1. Проверить количество ошибок в Sentry
2. Проанализировать медленные операции
3. Выявить новые проблемы
4. Обновить документацию

### 5.2 Метрики для отслеживания

| Метрика | Целевое значение | Действие |
|---------|-----------------|----------|
| Ошибки в час | < 10 | Исследовать, если > 10 |
| Время регистрации | < 500ms | Оптимизировать, если > 1s |
| Время создания игры | < 1000ms | Оптимизировать, если > 2s |
| Время присоединения | < 500ms | Оптимизировать, если > 1s |
| Покрытие логированием | > 95% | Добавить логирование |

### 5.3 Инструменты для анализа

**Sentry:**
- Просмотр ошибок в реальном времени
- Анализ трендов
- Уведомления о критичных ошибках

**Grep/AWK для локального анализа:**
```bash
# Найти медленные операции
grep "Duration:" logs.txt | awk -F'Duration: ' '{print $2}' | sort -rn | head -20

# Подсчитать ошибки по типам
grep "\[ERROR\]" logs.txt | awk -F'operation' '{print $2}' | sort | uniq -c | sort -rn

# Найти операции с высокой вариативностью
grep "registerUser" logs.txt | grep "Duration:" | awk -F'Duration: ' '{print $2}' | sort -n
```

---

## 6. Документирование

### 6.1 Документы проекта

| Документ | Назначение | Аудитория |
|----------|-----------|-----------|
| [`ENHANCED_CONSOLE_LOGGER_PRINCIPLES.md`](ENHANCED_CONSOLE_LOGGER_PRINCIPLES.md) | Полное руководство | Все разработчики |
| [`LOGGER_QUICK_REFERENCE.md`](LOGGER_QUICK_REFERENCE.md) | Быстрая шпаргалка | Новые разработчики |
| [`LOGGER_IMPLEMENTATION_GUIDE.md`](LOGGER_IMPLEMENTATION_GUIDE.md) | Руководство внедрения | Tech leads |
| [`enhanced-logging-system.md`](enhanced-logging-system.md) | Архитектура системы | Архитекторы |

### 6.2 Обновление документации

**При добавлении нового компонента:**
1. Добавить пример в LOGGER_QUICK_REFERENCE.md
2. Обновить статистику использования в ENHANCED_CONSOLE_LOGGER_PRINCIPLES.md
3. Добавить в чек-лист миграции

---

## 7. Заключение

### 7.1 Текущий статус

✅ **Реализовано:**
- Базовая система логирования
- Использование во всех основных компонентах
- Корреляционные ID для трассировки
- Структурированный формат логов

⚠️ **В процессе:**
- Интеграция с внешними системами мониторинга
- Стандартизация метаданных
- Оптимизация производительности

### 7.2 Следующие шаги

1. **Неделя 1-2:** Стандартизация корреляционных ID и метаданных
2. **Неделя 3-4:** Интеграция с Sentry
3. **Неделя 5-6:** Настройка мониторинга и алертов
4. **Неделя 7+:** Постоянная поддержка и оптимизация

### 7.3 Ожидаемые результаты

✅ **Улучшенная наблюдаемость**
- Полная трассировка операций через все слои
- Быстрая идентификация проблем
- Анализ производительности

✅ **Лучшая отладка**
- Корреляционные ID для связи логов
- Полный контекст каждой операции
- Время выполнения для оптимизации

✅ **Проактивный мониторинг**
- Автоматические алерты о проблемах
- Анализ трендов
- Предотвращение проблем в production

---

## Контакты и поддержка

- 📖 Документация: `/documentation`
- 💻 Исходный код: `/src/shared/enhanced-logger.ts`
- 🐛 Проблемы: GitHub Issues
- 💬 Вопросы: Team Slack
