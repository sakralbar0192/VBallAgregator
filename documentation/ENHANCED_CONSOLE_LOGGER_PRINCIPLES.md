# Принципы использования EnhancedConsoleLogger в проекте VBallAgregator

## Обзор

`EnhancedConsoleLogger` — это базовый класс структурированного логирования, который обеспечивает единообразный формат вывода логов с поддержкой архитектурных слоев, контекстной информации и трассировки операций. Это фундамент системы логирования проекта.

---

## 1. Архитектурные принципы

### 1.1 Слоистая архитектура логирования

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

## 2. Структурированное логирование

### 2.1 Формат логов

Каждый лог содержит структурированную информацию:

```
[LEVEL] TIMESTAMP [LAYER] COMPONENT.OPERATION: MESSAGE | Context: {...} | Meta: {...} | Duration: XXXms
```

**Пример:**
```
[INFO] 2025-11-18T02:53:00.000Z [PRESENTATION] bot.registration-handler.handleUserStart: User initiated /start command | Context: {"layer":"PRESENTATION","component":"bot.registration-handler","operation":"handleUserStart","correlationId":"start_123456789_1635000000000","telegramId":123456789} | Meta: {"firstName":"John"}
```

### 2.2 Компоненты структурированного лога

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

## 3. Контекстная информация

### 3.1 Корреляционные ID

Корреляционный ID — это уникальный идентификатор, который связывает все логи одной операции через разные слои приложения.

**Использование:**
```typescript
const correlationId = `register_${telegramId}_${Date.now()}`;

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

### 3.2 Метаданные операции

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

## 4. Уровни логирования

### 4.1 INFO — Информационные сообщения

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

### 4.2 WARN — Предупреждения

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

### 4.3 ERROR — Ошибки

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

### 4.4 DEBUG — Отладочная информация

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

## 5. Практические паттерны использования

### 5.1 Паттерн: Логирование операции с трассировкой

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

### 5.2 Паттерн: Логирование в обработчике бота

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

### 5.3 Паттерн: Логирование в сервисе приложения

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

### 5.4 Паттерн: Логирование в репозитории

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

### 5.5 Паттерн: Отслеживание производительности

```typescript
const tracker = logger.startTracking('registerUser', { telegramId });

try {
  const user = await userService.registerUser(telegramId, name);
  
  tracker.set('userId', user.id);
  tracker.set('status', 'success');
  
  const metrics = tracker.end();
  console.log(`Operation took ${metrics.duration}ms`);
} catch (error) {
  tracker.end();
  throw error;
}
```

---

## 6. Рекомендации по именованию

### 6.1 Компоненты

**Формат:** `layer.component-name` или `layer.type.component-name`

**Примеры:**
```typescript
LoggerFactory.bot('registration-handler')
LoggerFactory.bot('game-management-handler')
LoggerFactory.useCase('registerUser')
LoggerFactory.useCase('joinGame')
LoggerFactory.service('user-service')
LoggerFactory.service('game-service')
LoggerFactory.repository('user-repository')
LoggerFactory.repository('game-repository')
LoggerFactory.external('telegram-api')
LoggerFactory.external('payment-gateway')
```

### 6.2 Операции

**Формат:** camelCase, глагол + существительное

**Примеры:**
```typescript
'handleUserStart'
'handleGameCreation'
'registerUser'
'joinGame'
'createGame'
'upsertUser'
'findGameById'
'sendMessage'
'processPayment'
```

### 6.3 Корреляционные ID

**Формат:** `operation_identifier_timestamp`

**Примеры:**
```typescript
`register_${telegramId}_${Date.now()}`
`join_${userId}_${gameId}_${Date.now()}`
`create_game_${organizerId}_${Date.now()}`
`payment_${userId}_${gameId}_${Date.now()}`
```

---

## 7. Интеграция с внешними системами мониторинга

### 7.1 Текущая реализация

В production режиме ERROR логи отправляются на внешний сервис логирования:

```typescript
if (process.env.NODE_ENV === 'production' && entry.level === 'ERROR') {
  this.sendToExternalService(entry);
}
```

### 7.2 Рекомендуемые системы мониторинга

| Система | Назначение | Интеграция |
|---------|-----------|-----------|
| **CloudWatch (AWS)** | Централизованное логирование | Через AWS SDK |
| **DataDog** | Мониторинг и аналитика | Через HTTP API |
| **ELK Stack** | Поиск и анализ логов | Через Elasticsearch |
| **Grafana Loki** | Логирование и мониторинг | Через Loki API |
| **Sentry** | Отслеживание ошибок | Через Sentry SDK |

---

## 8. Лучшие практики

### 8.1 ✅ Делайте

- **Используйте корреляционные ID** для трассировки операций через слои
- **Логируйте начало и конец** критичных операций
- **Включайте контекстную информацию** (userId, gameId, telegramId)
- **Используйте правильные уровни** (INFO для успеха, ERROR для ошибок)
- **Логируйте время выполнения** для операций с БД и внешними сервисами
- **Структурируйте метаданные** в виде объектов, а не строк
- **Используйте фабрику LoggerFactory** вместо создания логгеров вручную

### 8.2 ❌ Не делайте

- **Не логируйте чувствительные данные** (пароли, токены, платежные реквизиты)
- **Не используйте console.log** напрямую — используйте логгер
- **Не создавайте новый логгер** для каждой операции — переиспользуйте
- **Не логируйте весь объект** — выбирайте нужные поля
- **Не забывайте корреляционный ID** при переходе между слоями
- **Не игнорируйте DEBUG логи** в разработке — они помогают отладке

### 8.3 Примеры антипаттернов

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

## 9. Отладка с использованием логов

### 9.1 Поиск операции по корреляционному ID

```bash
grep "register_123456789_" logs.txt
```

Результат покажет весь путь операции через все слои.

### 9.2 Анализ производительности

```bash
grep "Duration:" logs.txt | grep -E "Duration: [0-9]{4,}"
```

Найдет операции, выполнявшиеся дольше 1000ms.

### 9.3 Отслеживание ошибок

```bash
grep "\[ERROR\].*\[APPLICATION\]" logs.txt
grep "telegramId.*123456789" logs.txt | grep "\[ERROR\]"
```

---

## 10. Текущее состояние проекта

### 10.1 Использование в проекте

На данный момент `EnhancedConsoleLogger` используется через [`LoggerFactory`](src/shared/layer-logger.ts:398) во всех основных компонентах:

**Presentation Layer:**
- [`src/bot/common/base-handler.ts`](src/bot/common/base-handler.ts:11) — базовый класс обработчиков
- Все обработчики команд (registration, game-management, payments и т.д.)

**Application Layer:**
- [`src/application/use-cases.ts`](src/application/use-cases.ts:39) — все use cases
- [`src/application/services/`](src/application/services/) — сервисы приложения

**Infrastructure Layer:**
- [`src/infrastructure/repositories/base-repository.ts`](src/infrastructure/repositories/base-repository.ts:13) — базовый класс репозиториев
- [`src/shared/event-handlers.ts`](src/shared/event-handlers.ts:12) — обработчики событий

### 10.2 Статистика использования

- **67 результатов** использования LoggerFactory в коде
- **Все основные операции** логируются с корреляционными ID
- **Все слои архитектуры** используют структурированное логирование

---

## 11. Заключение

`EnhancedConsoleLogger` обеспечивает:

✅ **Структурированность** — предсказуемый формат логов  
✅ **Трассируемость** — корреляционные ID для отслеживания операций  
✅ **Архитектурную осведомленность** — логирование по слоям  
✅ **Контекстность** — полная информация о каждой операции  
✅ **Производительность** — минимальные накладные расходы  
✅ **Масштабируемость** — готовность к интеграции с внешними системами  

Следуя этим принципам, вы обеспечите высокую наблюдаемость системы и упростите отладку проблем в production.
