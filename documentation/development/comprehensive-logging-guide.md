# Enhanced Console Logger - Полное руководство

> **Версия:** 1.0 | **Последнее обновление:** 2025-11-24 | **Статус:** Production Ready ✅

## 🎯 Обзор

**EnhancedConsoleLogger** — это система структурированного логирования, которая обеспечивает полную трассировку операций через все архитектурные слои приложения с помощью корреляционных ID, контекстной информации и стандартизированного формата.

### Ключевые возможности:
✅ **Структурированность** — предсказуемый формат логов  
✅ **Трассируемость** — корреляционные ID для отслеживания операций  
✅ **Архитектурная осведомленность** — логирование по слоям  
✅ **Контекстность** — полная информация о каждой операции  
✅ **Производительность** — минимальные накладные расходы  
✅ **Масштабируемость** — готовность к интеграции с внешними системами  

---

## 🏗️ Архитектурные принципы

### Слоистая архитектура логирования

Система логирования отражает пятиуровневую архитектуру приложения:

```
┌─────────────────────────────────────────────────────┐
│ PRESENTATION (Telegram Bot Handlers)                │
│ → LoggerFactory.bot('handler-name')                 │
└─────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────┐
│ APPLICATION (Use Cases & Services)                  │
│ → LoggerFactory.useCase('operation')                │
│ → LoggerFactory.service('service-name')             │
└─────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────┐
│ DOMAIN (Business Logic & Validation)                │
│ → LoggerFactory.domainService('service-name')       │
└─────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────┐
│ INFRASTRUCTURE (Repositories & External Services)   │
│ → LoggerFactory.repository('repo-name')             │
│ → LoggerFactory.external('service-name')            │
└─────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────┐
│ CROSS_CUTTING (Events, Notifications, Metrics)      │
│ → LoggerFactory.external('event-handlers')          │
└─────────────────────────────────────────────────────┘
```

**Принцип**: Каждый слой использует свой логгер, что позволяет быстро определить, где произошла проблема, фильтровать логи по слоям и применять разные уровни детализации.

---

## 📝 Структурированное логирование

### Формат логов

Каждый лог содержит структурированную информацию:
```
[LEVEL] TIMESTAMP [LAYER] COMPONENT.OPERATION: MESSAGE | Context: {...} | Meta: {...} | Duration: XXXms
```

**Пример:**
```
[INFO] 2025-11-18T02:53:00.000Z [PRESENTATION] bot.registration-handler.handleUserStart: User initiated /start command | Context: {"layer":"PRESENTATION","component":"bot.registration-handler","operation":"handleUserStart","correlationId":"start_123456789_1635000000000","telegramId":123456789} | Meta: {"firstName":"John"}
```

### Компоненты структурированного лога

| Поле | Назначение | Пример |
|------|-----------|--------|
| `level` | Уровень логирования | `INFO`, `WARN`, `ERROR`, `DEBUG` |
| `timestamp` | ISO 8601 временная метка | `2025-11-18T02:53:00.000Z` |
| `layer` | Архитектурный слой | `PRESENTATION`, `APPLICATION`, `DOMAIN` |
| `component` | Компонент системы | `bot.registration-handler`, `service.user-service` |
| `operation` | Название операции | `handleUserStart`, `registerUser` |
| `message` | Текстовое описание | `User initiated /start command` |
| `context` | Контекст операции | `{layer, component, operation, correlationId, ...}` |
| `metadata` | Дополнительные данные | `{telegramId, firstName, ...}` |
| `correlationId` | ID для трассировки | `start_123456789_1635000000000` |
| `executionTimeMs` | Время выполнения | `245` |

---

## 🔗 Контекстная информация

### Корреляционные ID

Корреляционный ID — это уникальный идентификатор, который связывает все логи одной операции через разные слои приложения.

**Генерация:**
```typescript
const correlationId = `register_${telegramId}_${Date.now()}`;
// Результат: "register_123456789_1635000000000"
```

**Использование:**
```typescript
const useCaseLogger = LoggerFactory.useCase('registerUser');
useCaseLogger.info('registerUser', 'Processing registration', 
  { telegramId },
  { correlationId, telegramId }
);
```

**Преимущества:**
- Отследить полный путь операции от ввода до базы данных
- Найти все логи одной операции в больших логах
- Отладить проблемы, связанные с конкретной операцией пользователя

### Метаданные операции

Метаданные содержат контекстную информацию, специфичную для операции:

```typescript
// Минимальные метаданные
{ telegramId: 123456789 }

// Расширенные метаданные
{ 
  telegramId: 123456789,
  firstName: "John",
  level: "intermediate",
  organizerId: "org_123"
}

// Метаданные с результатом
{
  telegramId: 123456789,
  userId: "user_456",
  executionTimeMs: 245
}
```

---

## 📊 Уровни логирования

### INFO — Информационные сообщения

**Когда использовать:**
- Успешное завершение операции
- Начало важной операции
- Переходы между слоями
- Значимые события в системе

**Примеры:**
```typescript
logger.info('registerUser', 'User registration started', { telegramId });
logger.info('joinGame', 'Player successfully joined game', { playerId, gameId });
logger.info('sendMessage', 'Notification sent to user', { telegramId, messageType });
```

### WARN — Предупреждения

**Когда использовать:**
- Бизнес-правило не пройдено, но операция продолжается
- Некритичные ошибки, которые можно обработать
- Неожиданные, но допустимые ситуации
- Потенциальные проблемы, требующие внимания

**Примеры:**
```typescript
logger.warn('joinGame', 'Player already registered for this game', { playerId, gameId });
logger.warn('createGame', 'Game created with minimum players', { gameId, playerCount });
logger.warn('payment', 'Payment retry attempt', { userId, attemptNumber: 3 });
```

### ERROR — Ошибки

**Когда использовать:**
- Операция не удалась
- Исключение или ошибка выполнения
- Нарушение критичного бизнес-правила
- Проблемы с внешними сервисами

**Примеры:**
```typescript
logger.error('registerUser', 'Failed to register user', error, { telegramId });
logger.error('joinGame', 'Database error while joining game', error, { playerId, gameId });
logger.error('sendMessage', 'Telegram API error', error, { telegramId });
```

**В production:** Ошибки автоматически отправляются на внешний сервис логирования.

### DEBUG — Отладочная информация

**Когда использовать:**
- Детальная информация о ходе выполнения (только в разработке)
- Промежуточные значения переменных
- Операции базы данных
- Детали валидации

**Примеры:**
```typescript
logger.debug('registerUser', 'User data validation passed', { validationRules: [...] });
logger.debug('upsertUser', 'Database UPSERT on users', { table: 'users', action: 'UPSERT' });
logger.debug('joinGame', 'Checking player availability', { playerStatus: 'active' });
```

**Важно:** DEBUG логи выводятся только в режиме разработки (`NODE_ENV === 'development'`).

---

## 🛠️ Использование

### Создание логгера

#### По слоям архитектуры

```typescript
// Presentation Layer (Bot Handlers)
const logger = LoggerFactory.bot('handler-name');

// Application Layer (Use Cases)
const logger = LoggerFactory.useCase('operationName');

// Application Layer (Services)
const logger = LoggerFactory.service('service-name');

// Domain Layer
const logger = LoggerFactory.domainService('service-name');

// Infrastructure Layer (Repositories)
const logger = LoggerFactory.repository('repo-name');

// Infrastructure Layer (External Services)
const logger = LoggerFactory.external('service-name');
```

### Методы логирования

#### info() — Успешные операции

```typescript
logger.info(
  'operationName',           // Название операции
  'Message text',            // Текстовое сообщение
  { key: 'value' },          // Метаданные (опционально)
  { correlationId: 'id' }    // Контекст (опционально)
);
```

#### warn() — Предупреждения

```typescript
logger.warn(
  'operationName',
  'Warning message',
  { key: 'value' },
  { correlationId: 'id' }
);
```

#### error() — Ошибки

```typescript
logger.error(
  'operationName',
  'Error message',
  error,                     // Объект Error
  { key: 'value' },
  { correlationId: 'id' }
);
```

#### debug() — Отладка (только в разработке)

```typescript
logger.debug(
  'operationName',
  'Debug message',
  { key: 'value' },
  { correlationId: 'id' }
);
```

### Специализированные методы

#### database() — Операции БД

```typescript
logger.database(
  'operationName',           // Название операции
  'tableName',               // Таблица
  'SELECT|INSERT|UPDATE|DELETE', // Действие
  { data: 'value' },         // Данные (опционально)
  duration                   // Время выполнения (опционально)
);
```

#### external() — Внешние сервисы

```typescript
logger.external(
  'operationName',
  'service-name',            // Название сервиса
  'actionName',              // Действие
  true,                      // Успешно ли
  duration,                  // Время выполнения (опционально)
  error                      // Ошибка (опционально)
);
```

#### validation() — Валидация

```typescript
logger.validation(
  'operationName',
  'Rule description',        // Описание правила
  true,                      // Пройдена ли валидация
  { details: 'value' }       // Детали (опционально)
);
```

#### entry() / exit() — Точки входа/выхода

```typescript
logger.entry('operationName', { data: 'value' });
// ... выполнение операции ...
logger.exit('operationName', { result: 'value' });
```

### Отслеживание производительности

#### startTracking()

```typescript
const tracker = logger.startTracking('operationName', { initialData: 'value' });

// Добавить метаданные
tracker.set('key', 'value');

// Завершить и получить метрики
const { duration, metadata } = tracker.end();
```

#### logOperation() — Автоматическое отслеживание

```typescript
const result = await logger.logOperation(
  'operationName',
  async () => {
    // Выполнение операции
    return await someAsyncOperation();
  },
  { correlationId: 'id' },   // Контекст (опционально)
  { initialData: 'value' }   // Метаданные (опционально)
);
```

---

## 💡 Практические паттерны

### 1. Логирование операции с трассировкой

```typescript
import { LoggerFactory } from '../../shared/layer-logger.js';

export async function registerUser(telegramId: number, name: string) {
  const useCaseLogger = LoggerFactory.useCase('registerUser');
  const correlationId = `register_${telegramId}_${Date.now()}`;

  useCaseLogger.info('registerUser', 'Processing user registration request',
    { telegramId, name },
    { correlationId, telegramId }
  );

  try {
    const user = await userService.registerUser({ telegramId, name });
    
    useCaseLogger.info('registerUser', 'User registered successfully',
      { userId: user.id, telegramId },
      { correlationId }
    );
    
    return user;
  } catch (error) {
    useCaseLogger.error('registerUser', 'Failed to register user',
      error as Error,
      { telegramId, errorMessage: (error as Error).message },
      { correlationId }
    );
    throw error;
  }
}
```

### 2. Логирование в обработчике бота

```typescript
import { BaseHandler } from '../common/base-handler.js';
import { LoggerFactory } from '../../shared/layer-logger.js';

export class RegistrationHandler extends BaseHandler {
  protected static override logger = LoggerFactory.bot('registration-handler');

  static async handleUserStart(ctx: Context) {
    const telegramId = ctx.from.id;
    const correlationId = `start_${telegramId}_${Date.now()}`;

    RegistrationHandler.logger.info('handleUserStart', 
      'User initiated /start command',
      { telegramId, firstName: ctx.from.first_name },
      { correlationId, telegramId }
    );

    try {
      const result = await registerUser(telegramId, ctx.from.first_name);
      
      RegistrationHandler.logger.info('handleUserStart',
        'User start command processed successfully',
        { userId: result.id },
        { correlationId }
      );
    } catch (error) {
      RegistrationHandler.logger.error('handleUserStart',
        'Failed to process user start command',
        error as Error,
        { telegramId },
        { correlationId }
      );
      throw error;
    }
  }
}
```

### 3. Логирование в сервисе приложения

```typescript
import { LoggerFactory } from '../../shared/layer-logger.js';

export class UserApplicationService {
  async registerUser(command: RegisterUserCommand) {
    const serviceLogger = LoggerFactory.service('user-service');
    const correlationId = command.correlationId || `service_${Date.now()}`;

    serviceLogger.info('registerUser', 'Invoking user repository operation',
      { telegramId: command.telegramId },
      { correlationId }
    );

    try {
      const user = await this.userRepository.upsertUser({
        telegramId: command.telegramId,
        name: command.name
      });

      serviceLogger.info('registerUser', 'User persisted successfully',
        { userId: user.id },
        { correlationId }
      );

      return user;
    } catch (error) {
      serviceLogger.error('registerUser', 'Repository operation failed',
        error as Error,
        { telegramId: command.telegramId },
        { correlationId }
      );
      throw error;
    }
  }
}
```

### 4. Логирование в репозитории

```typescript
import { LoggerFactory } from '../../shared/layer-logger.js';

export class UserRepository extends BaseRepository {
  constructor() {
    super('user-repository');
  }

  async upsertUser(data: { telegramId: number; name: string }) {
    this.logger.database('upsertUser', 'users', 'UPSERT', {
      telegramId: data.telegramId,
      name: data.name
    });

    try {
      const user = await prisma.user.upsert({
        where: { telegramId: data.telegramId },
        update: { name: data.name },
        create: { telegramId: data.telegramId, name: data.name }
      });

      this.logger.debug('upsertUser', 'User upserted successfully',
        { userId: user.id }
      );

      return user;
    } catch (error) {
      this.logger.error('upsertUser', 'Database operation failed',
        error as Error,
        { telegramId: data.telegramId }
      );
      throw error;
    }
  }
}
```

---

## 🎯 Лучшие практики

### ✅ Делайте

- **Используйте корреляционные ID** для трассировки операций через слои
- **Логируйте начало и конец** критичных операций
- **Включайте контекстную информацию** (userId, gameId, telegramId)
- **Используйте правильные уровни** (INFO для успеха, ERROR для ошибок)
- **Логируйте время выполнения** для операций с БД и внешними сервисами
- **Структурируйте метаданные** в виде объектов, а не строк
- **Используйте фабрику LoggerFactory** вместо создания логгеров вручную

### ❌ Не делайте

- **Не логируйте чувствительные данные** (пароли, токены, платежные реквизиты)
- **Не используйте console.log** напрямую — используйте логгер
- **Не создавайте новый логгер** для каждой операции — переиспользуйте
- **Не логируйте весь объект** — выбирайте нужные поля
- **Не забывайте корреляционный ID** при переходе между слоями
- **Не игнорируйте DEBUG логи** в разработке — они помогают отладке

### Примеры антипаттернов

```typescript
// ❌ Плохо: console.log вместо логгера
console.log('User registered:', user);

// ✅ Хорошо: структурированное логирование
logger.info('registerUser', 'User registered successfully', { userId: user.id });

// ❌ Плохо: логирование всего объекта
logger.info('joinGame', 'Player joined', { player: playerObject });

// ✅ Хорошо: логирование нужных полей
logger.info('joinGame', 'Player joined game', { playerId: player.id, gameId });

// ❌ Плохо: без корреляционного ID
logger.info('operation', 'Something happened', { data });

// ✅ Хорошо: с корреляционным ID
logger.info('operation', 'Something happened', { data }, { correlationId });

// ❌ Плохо: логирование чувствительных данных
logger.info('payment', 'Payment processed', { cardNumber: '1234-5678-9012-3456' });

// ✅ Хорошо: логирование только необходимых данных
logger.info('payment', 'Payment processed', { paymentId, amount, status });
```

---

## 🔍 Отладка с использованием логов

### Поиск операции по корреляционному ID

```bash
grep "register_123456789_" logs.txt
```

Результат покажет весь путь операции через все слои.

### Анализ производительности

```bash
grep "Duration:" logs.txt | grep -E "Duration: [0-9]{4,}"
```

Найдет операции, выполнявшиеся дольше 1000ms.

### Отслеживание ошибок

```bash
grep "\[ERROR\].*\[APPLICATION\]" logs.txt
grep "telegramId.*123456789" logs.txt | grep "\[ERROR\]"
```

---

## 🔗 Интеграция с внешними системами

### Текущая реализация

В production режиме ERROR логи отправляются на внешний сервис логирования:

```typescript
if (process.env.NODE_ENV === 'production' && entry.level === 'ERROR') {
  this.sendToExternalService(entry);
}
```

### Рекомендуемые системы мониторинга

| Система | Назначение | Интеграция |
|---------|-----------|-----------|
| **CloudWatch (AWS)** | Централизованное логирование | Через AWS SDK |
| **DataDog** | Мониторинг и аналитика | Через HTTP API |
| **ELK Stack** | Поиск и анализ логов | Через Elasticsearch |
| **Grafana Loki** | Логирование и мониторинг | Через Loki API |
| **Sentry** | Отслеживание ошибок | Через Sentry SDK |

### Интеграция с Sentry

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

---

## 📈 Метрики для отслеживания

| Метрика | Целевое значение | Действие |
|---------|-----------------|----------|
| Ошибки в час | < 10 | Исследовать, если > 10 |
| Время регистрации | < 500ms | Оптимизировать, если > 1s |
| Время создания игры | < 1000ms | Оптимизировать, если > 2s |
| Время присоединения | < 500ms | Оптимизировать, если > 1s |
| Покрытие логированием | > 95% | Добавить логирование |

---

## 🚀 Статус проекта

### ✅ Реализовано

- Базовая система логирования (`EnhancedConsoleLogger`)
- Специализированные логгеры по слоям (`LayerLogger`)
- Фабрика логгеров (`LoggerFactory`)
- Использование во всех основных компонентах (67 точек)
- Корреляционные ID для трассировки
- Структурированный формат логов

### ⚠️ В процессе

- Интеграция с внешними системами мониторинга
- Стандартизация метаданных
- Оптимизация производительности

### 📋 Следующие шаги

1. **Неделя 1-2:** Стандартизация корреляционных ID и метаданных
2. **Неделя 3-4:** Интеграция с Sentry
3. **Неделя 5-6:** Настройка мониторинга и алертов
4. **Неделя 7+:** Постоянная поддержка и оптимизация

---

## 📚 Справочная информация

### Популярные команды для отладки

| Задача | Команда |
|--------|---------|
| Поиск операции по корреляционному ID | `grep "register_123456789_" logs.txt` |
| Поиск медленных операций | `grep "Duration:" logs.txt \| grep -E "Duration: [0-9]{4,}"` |
| Поиск ошибок в слое | `grep "\[ERROR\].*\[APPLICATION\]" logs.txt` |
| Поиск ошибок пользователя | `grep "telegramId.*123456789" logs.txt \| grep "\[ERROR\]"` |

### Стандартные метаданные

```typescript
{
  telegramId: 123456789,      // ID пользователя в Telegram
  userId: 'user_123',         // ID пользователя в системе
  gameId: 'game_456',         // ID игры
  organizerId: 'org_789',     // ID организатора
  firstName: 'John',          // Имя пользователя
  status: 'active',           // Статус операции
  errorMessage: 'Error text', // Текст ошибки
  duration: 245,              // Время выполнения в ms
  executionTimeMs: 245        // Альтернативное имя для duration
}
```

### Стандартные поля контекста

```typescript
{
  correlationId: 'register_123456789_1635000000000',  // ID для трассировки
  telegramId: 123456789,                              // ID пользователя
  userId: 'user_123',                                 // ID в системе
  gameId: 'game_456',                                 // ID игры
  executionTimeMs: 245                                // Время выполнения
}
```

---

## 🔗 Ссылки

- 💻 [Исходный код EnhancedConsoleLogger](../src/shared/enhanced-logger.ts)
- 💻 [Исходный код LayerLogger](../src/shared/layer-logger.ts)
- 📖 [Быстрая шпаргалка](LOGGER_QUICK_REFERENCE.md)
- 📋 [Руководство внедрения](LOGGER_IMPLEMENTATION_GUIDE.md)
- 🏗️ [Архитектура системы](enhanced-logging-system.md)

---

**Для новых разработчиков:**

1. **Прочитайте** этот документ (30 минут)
2. **Посмотрите примеры** в [LOGGER_QUICK_REFERENCE.md](LOGGER_QUICK_REFERENCE.md) (20 минут)
3. **Используйте** LoggerFactory в своем коде
4. **Спросите** у team lead, если что-то непонятно

---

**Последнее обновление:** 2025-11-24  
**Версия:** 1.0  
**Статус:** Production Ready ✅