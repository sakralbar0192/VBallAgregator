# EnhancedConsoleLogger — Быстрая шпаргалка

## Импорт

```typescript
import { LoggerFactory } from '../../shared/layer-logger.js';
```

---

## Создание логгера

### По слоям архитектуры

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

---

## Методы логирования

### info() — Успешные операции

```typescript
logger.info(
  'operationName',           // Название операции
  'Message text',            // Текстовое сообщение
  { key: 'value' },          // Метаданные (опционально)
  { correlationId: 'id' }    // Контекст (опционально)
);
```

### warn() — Предупреждения

```typescript
logger.warn(
  'operationName',
  'Warning message',
  { key: 'value' },
  { correlationId: 'id' }
);
```

### error() — Ошибки

```typescript
logger.error(
  'operationName',
  'Error message',
  error,                     // Объект Error
  { key: 'value' },
  { correlationId: 'id' }
);
```

### debug() — Отладка (только в разработке)

```typescript
logger.debug(
  'operationName',
  'Debug message',
  { key: 'value' },
  { correlationId: 'id' }
);
```

---

## Специализированные методы

### database() — Операции БД

```typescript
logger.database(
  'operationName',           // Название операции
  'tableName',               // Таблица
  'SELECT|INSERT|UPDATE|DELETE', // Действие
  { data: 'value' },         // Данные (опционально)
  duration                   // Время выполнения (опционально)
);
```

### external() — Внешние сервисы

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

### validation() — Валидация

```typescript
logger.validation(
  'operationName',
  'Rule description',        // Описание правила
  true,                      // Пройдена ли валидация
  { details: 'value' }       // Детали (опционально)
);
```

### entry() / exit() — Точки входа/выхода

```typescript
logger.entry('operationName', { data: 'value' });
// ... выполнение операции ...
logger.exit('operationName', { result: 'value' });
```

---

## Отслеживание производительности

### startTracking()

```typescript
const tracker = logger.startTracking('operationName', { initialData: 'value' });

// Добавить метаданные
tracker.set('key', 'value');

// Завершить и получить метрики
const { duration, metadata } = tracker.end();
```

### logOperation() — Автоматическое отслеживание

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

## Корреляционные ID

### Генерация

```typescript
import { generateCorrelationId } from '../../shared/enhanced-logger.js';

const correlationId = generateCorrelationId();
// Результат: "corr_1635000000000_abc123def"
```

### Использование

```typescript
const correlationId = `register_${telegramId}_${Date.now()}`;

logger.info('registerUser', 'Starting registration',
  { telegramId },
  { correlationId, telegramId }
);
```

### Установка по умолчанию

```typescript
logger.withCorrelationId(correlationId);
// Все последующие логи будут использовать этот ID
```

---

## Примеры по слоям

### Presentation Layer (Bot Handler)

```typescript
import { BaseHandler } from '../common/base-handler.js';
import { LoggerFactory } from '../../shared/layer-logger.js';

export class MyHandler extends BaseHandler {
  protected static override logger = LoggerFactory.bot('my-handler');

  static async handleCommand(ctx: Context) {
    const telegramId = ctx.from.id;
    const correlationId = `cmd_${telegramId}_${Date.now()}`;

    MyHandler.logger.info('handleCommand', 'Command received',
      { telegramId, command: ctx.message.text },
      { correlationId, telegramId }
    );

    try {
      const result = await processCommand(ctx);
      MyHandler.logger.info('handleCommand', 'Command processed',
        { result },
        { correlationId }
      );
    } catch (error) {
      MyHandler.logger.error('handleCommand', 'Command failed',
        error as Error,
        { telegramId },
        { correlationId }
      );
      throw error;
    }
  }
}
```

### Application Layer (Use Case)

```typescript
import { LoggerFactory } from '../shared/layer-logger.js';

export async function registerUser(telegramId: number, name: string) {
  const logger = LoggerFactory.useCase('registerUser');
  const correlationId = `register_${telegramId}_${Date.now()}`;

  logger.info('registerUser', 'Processing registration',
    { telegramId, name },
    { correlationId, telegramId }
  );

  try {
    const user = await userService.registerUser({ telegramId, name });
    logger.info('registerUser', 'User registered',
      { userId: user.id },
      { correlationId }
    );
    return user;
  } catch (error) {
    logger.error('registerUser', 'Registration failed',
      error as Error,
      { telegramId },
      { correlationId }
    );
    throw error;
  }
}
```

### Application Layer (Service)

```typescript
import { LoggerFactory } from '../../shared/layer-logger.js';

export class UserService {
  private logger = LoggerFactory.service('user-service');

  async registerUser(data: RegisterUserData) {
    this.logger.info('registerUser', 'Invoking repository',
      { telegramId: data.telegramId },
      { correlationId: data.correlationId }
    );

    const user = await this.userRepository.upsertUser(data);
    return user;
  }
}
```

### Infrastructure Layer (Repository)

```typescript
import { LoggerFactory } from '../../shared/layer-logger.js';

export class UserRepository extends BaseRepository {
  constructor() {
    super('user-repository');
  }

  async upsertUser(data: UserData) {
    const startTime = Date.now();

    this.logger.database('upsertUser', 'users', 'UPSERT', {
      telegramId: data.telegramId
    });

    try {
      const user = await prisma.user.upsert({
        where: { telegramId: data.telegramId },
        update: { name: data.name },
        create: { telegramId: data.telegramId, name: data.name }
      });

      const duration = Date.now() - startTime;
      this.logger.debug('upsertUser', 'User upserted',
        { userId: user.id, duration }
      );

      return user;
    } catch (error) {
      this.logger.error('upsertUser', 'Database error',
        error as Error,
        { telegramId: data.telegramId }
      );
      throw error;
    }
  }
}
```

---

## Уровни логирования

| Уровень | Когда использовать | Пример |
|---------|-------------------|--------|
| **INFO** | Успех, начало операции | `logger.info('registerUser', 'User registered', { userId })` |
| **WARN** | Бизнес-правило не пройдено | `logger.warn('joinGame', 'Player already joined', { playerId })` |
| **ERROR** | Ошибка, исключение | `logger.error('registerUser', 'Failed', error, { telegramId })` |
| **DEBUG** | Детали выполнения (разработка) | `logger.debug('upsertUser', 'Database operation', { table })` |

---

## Метаданные

### Стандартные поля

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

### Правила

- ✅ Используйте объекты, а не строки
- ✅ Включайте идентификаторы (userId, gameId, telegramId)
- ✅ Добавляйте время выполнения для операций с БД
- ❌ Не логируйте пароли, токены, платежные реквизиты
- ❌ Не логируйте весь объект — выбирайте нужные поля

---

## Контекст

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

### Использование

```typescript
logger.info('operation', 'Message',
  { metadata: 'value' },
  { correlationId, telegramId, userId }  // Контекст
);
```

---

## Форматирование вывода

### Структура лога

```
[LEVEL] TIMESTAMP [LAYER] COMPONENT.OPERATION: MESSAGE | Context: {...} | Meta: {...} | Duration: XXXms
```

### Пример вывода

```
[INFO] 2025-11-18T02:53:00.000Z [PRESENTATION] bot.registration-handler.handleUserStart: User initiated /start command | Context: {"layer":"PRESENTATION","component":"bot.registration-handler","operation":"handleUserStart","correlationId":"start_123456789_1635000000000","telegramId":123456789} | Meta: {"firstName":"John"}
```

---

## Частые ошибки

### ❌ Неправильно

```typescript
// Использование console.log
console.log('User registered:', user);

// Логирование всего объекта
logger.info('joinGame', 'Player joined', { player: playerObject });

// Без корреляционного ID
logger.info('operation', 'Something happened', { data });

// Логирование чувствительных данных
logger.info('payment', 'Payment processed', { cardNumber: '1234-5678-9012-3456' });

// Создание нового логгера каждый раз
const logger = LoggerFactory.bot('handler');
logger.info('operation', 'Message');
```

### ✅ Правильно

```typescript
// Использование логгера
logger.info('registerUser', 'User registered successfully', { userId: user.id });

// Логирование нужных полей
logger.info('joinGame', 'Player joined game', { playerId: player.id, gameId });

// С корреляционным ID
logger.info('operation', 'Something happened', { data }, { correlationId });

// Логирование только необходимых данных
logger.info('payment', 'Payment processed', { paymentId, amount, status });

// Переиспользование логгера
class MyHandler extends BaseHandler {
  protected static override logger = LoggerFactory.bot('handler');
  
  static async handle() {
    MyHandler.logger.info('operation', 'Message');
  }
}
```

---

## Полезные команды для отладки

### Поиск операции по корреляционному ID

```bash
grep "register_123456789_" logs.txt
```

### Поиск медленных операций

```bash
grep "Duration:" logs.txt | grep -E "Duration: [0-9]{4,}"
```

### Поиск ошибок в слое

```bash
grep "\[ERROR\].*\[APPLICATION\]" logs.txt
```

### Поиск ошибок пользователя

```bash
grep "telegramId.*123456789" logs.txt | grep "\[ERROR\]"
```

---

## Ссылки

- 📖 [Полная документация](ENHANCED_CONSOLE_LOGGER_PRINCIPLES.md)
- 📄 [Система логирования](enhanced-logging-system.md)
- 💻 [Исходный код EnhancedConsoleLogger](../src/shared/enhanced-logger.ts)
- 💻 [Исходный код LayerLogger](../src/shared/layer-logger.ts)
