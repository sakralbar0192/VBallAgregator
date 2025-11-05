# Улучшенная система логирования для проекта VBallAgregator

## Обзор

Внедрена новая система логирования, которая предоставляет структурированный, контекстно-осведомленный и архитектурно-осведомленный подход к логированию в многослойном приложении.

## Структура файлов

### Основные компоненты

1. **`src/shared/enhanced-logger.ts`** - Базовые типы и интерфейсы
2. **`src/shared/layer-logger.ts`** - Специализированные логгеры по архитектурным слоям
3. **`src/examples/enhanced-logging-example.ts`** - Примеры использования на всех уровнях

## Ключевые функции

### 1. Архитектурные слои

```typescript
enum ArchitectureLayer {
  PRESENTATION = 'PRESENTATION',    // Bot handlers, API controllers
  APPLICATION = 'APPLICATION',      // Use cases, Application services
  DOMAIN = 'DOMAIN',               // Domain services, Entities, Value objects
  INFRASTRUCTURE = 'INFRASTRUCTURE', // Repositories, External services
  CROSS_CUTTING = 'CROSS_CUTTING'   // Event bus, notifications, metrics
}
```

### 2. Контекстное логирование

```typescript
interface LogContext {
  layer: ArchitectureLayer;
  component: string;               // bot, user-service, game-repo, etc.
  operation: string;               // registerUser, createGame, upsertUser
  userId?: string;
  gameId?: string;
  telegramId?: string | number;
  correlationId?: string;          // Для трассировки цепочек операций
  timestamp?: string;
  executionTimeMs?: number;
}
```

### 3. Отслеживание производительности

```typescript
const tracker = logger.startTracking('registerUser', { telegramId });
// ... выполнение операции ...
tracker.end(); // Автоматически логирует время выполнения
```

### 4. Корреляционные ID для трассировки

```typescript
const correlationId = generateCorrelationId();
logger.withCorrelationId(correlationId);
```

## Использование по слоям

### 1. Presentation Layer (Bot Handlers)

```typescript
import { LoggerFactory } from './shared/layer-logger.js';

const botLogger = LoggerFactory.bot('start-handler');

botLogger.info('handleUserStart', 'User initiated /start command', 
  { telegramId, firstName: ctx.from.first_name },
  { correlationId, telegramId }
);
```

### 2. Application Layer (Use Cases)

```typescript
import { LoggerFactory } from '../shared/layer-logger.js';

const useCaseLogger = LoggerFactory.useCase('registerUser');

useCaseLogger.info('registerUser', 'Processing user registration request',
  { telegramId, name },
  { correlationId, telegramId }
);
```

### 3. Application Services

```typescript
import { LoggerFactory } from '../../shared/layer-logger.js';

const serviceLogger = LoggerFactory.service('user-service');

serviceLogger.info('registerUser', 'Invoking user repository operation',
  { telegramId },
  { layer: ArchitectureLayer.APPLICATION, component: 'user-service' }
);
```

### 4. Infrastructure Layer (Repositories)

```typescript
import { LoggerFactory } from '../../shared/layer-logger.js';

const repositoryLogger = LoggerFactory.repository('prisma-user-repo');

repositoryLogger.database('upsertUser', 'users', 'UPSERT', {
  telegramId,
  name
});
```

### 5. Domain Layer

```typescript
import { LoggerFactory } from '../../shared/layer-logger.js';

const domainLogger = LoggerFactory.domainService('user-domain');

domainLogger.validation('validateUser', 'User data validation', 
  validationResult.isValid, 
  validationResult
);
```

### 6. External Services

```typescript
import { LoggerFactory } from '../../shared/layer-logger.js';

const externalLogger = LoggerFactory.external('telegram-api');

externalLogger.external('sendMessage', 'telegram-api', 'sendMessage', 
  true, // success
  duration, // execution time
  error // if failed
);
```

## Пример миграции существующего кода

### Было:

```typescript
// src/bot.ts:26-30
bot.start(async (ctx) => {
  const telegramId = ctx.from.id;
  const name = ctx.from.first_name + (ctx.from.last_name ? ' ' + ctx.from.last_name : '');
  
  await registerUser(telegramId, name);
  // ... обработка ответа
});
```

### Стало:

```typescript
// Enhanced version with structured logging
import { LoggerFactory } from './shared/layer-logger.js';

const botLogger = LoggerFactory.bot('start-handler');

bot.start(async (ctx) => {
  const telegramId = ctx.from.id;
  const name = ctx.from.first_name + (ctx.from.last_name ? ' ' + ctx.from.last_name : '');
  const correlationId = `start_${telegramId}_${Date.now()}`;

  botLogger.info('handleUserStart', 'User initiated /start command', 
    { telegramId: Number(telegramId), firstName: ctx.from.first_name },
    { correlationId, telegramId: Number(telegramId) }
  );

  try {
    botLogger.entry('registerUser', { telegramId, name, correlationId });
    const result = await registerUser(telegramId, name);
    botLogger.exit('registerUser', { userId: result.userId, correlationId });
    
    // ... обработка ответа
    
  } catch (error) {
    botLogger.error('handleUserStart', 'Failed to process user start command', 
      error as Error, { telegramId, error: error.message }, { correlationId }
    );
    throw error;
  }
});
```

## Преимущества новой системы

### 1. **Структурированность**
- Каждое логирование содержит предсказуемый контекст
- JSON-совместимый формат вывода
- Согласованные поля для разных типов операций

### 2. **Архитектурная осведомленность**
- Логирование автоматически знает, на каком слое работает
- Различные методы для разных типов операций (database, external, validation)
- Иерархическая структура компонентов

### 3. **Трассируемость**
- Correlation ID для отслеживания операций между слоями
- Автоматическое отслеживание времени выполнения
- Контекстная информация в каждом сообщении

### 4. **Производительность**
- Оптимизированные методы с автоматическим отслеживанием
- Минимальные накладные расходы в production
- Возможность группировки логов по операциям

### 5. **Гибкость**
- Поддержка различных типов метаданных
- Возможность расширения без изменения API
- Съемная архитектура (можно легко заменить реализацию логгера)

## Рекомендации по внедрению

### 1. Постепенная миграция
Начните с критически важных операций:
- Регистрация пользователей
- Создание и запись на игры
- Обработка платежей

### 2. Унификация форматов
Используйте согласованные названия операций:
- `handleCommand` для ботовых обработчиков
- `processRequest` для use cases
- `executeOperation` для репозиториев

### 3. Мониторинг
Интегрируйте с внешними системами мониторинга:
- CloudWatch (AWS)
- DataDog
- ELK Stack
- Grafana Loki

### 4. Тестирование
- Добавьте unit-тесты для логгеров
- Проверяйте структуру логов в интеграционных тестах
- Мониторьте производительность новой системы

## Примеры вывода логов

### Информационный лог:
```
[INFO] 2025-11-05T00:55:00.000Z [PRESENTATION] bot.start-handler.handleUserStart: User initiated /start command | Context: {"layer":"PRESENTATION","component":"bot.start-handler","operation":"handleUserStart","timestamp":"2025-11-05T00:55:00.000Z","correlationId":"start_123456789_1635000000000","telegramId":123456789} | Meta: {"telegramId":123456789,"firstName":"John"}
```

### Лог с отслеживанием производительности:
```
[INFO] 2025-11-05T00:55:00.000Z [APPLICATION] use-case.registerUser.registerUser: Operation completed | Context: {"layer":"APPLICATION","component":"use-case.registerUser","operation":"registerUser","timestamp":"2025-11-05T00:55:00.000Z","correlationId":"start_123456789_1635000000000"} | Meta: {"executionTimeMs":245,"operation":"user_registration"} | Duration: 245ms
```

### Лог базы данных:
```
[DEBUG] 2025-11-05T00:55:00.000Z [INFRASTRUCTURE] repository.prisma-user-repo.upsertUser: Database UPSERT on users | Context: {"layer":"INFRASTRUCTURE","component":"repository.prisma-user-repo","operation":"upsertUser","timestamp":"2025-11-05T00:55:00.000Z"} | Meta: {"table":"users","action":"UPSERT","telegramId":123456789}
```

## Следующие шаги

1. **Обновить существующие модули** постепенно, начиная с критических путей
2. **Настроить мониторинг** для сбора и анализа новых логов
3. **Обучить команду** принципам работы с новой системой
4. **Создать guidelines** по стандартам логирования в проекте
5. **Периодически ревизировать** эффективность системы логирования

Эта система логирования обеспечивает прочную основу для наблюдаемости и отладки сложного волейбольного бота, делая процесс разработки и эксплуатации более эффективным.