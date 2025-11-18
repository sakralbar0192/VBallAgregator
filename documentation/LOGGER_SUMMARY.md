# EnhancedConsoleLogger — Резюме принципов

## 🎯 Суть в одном предложении

**EnhancedConsoleLogger** — это система структурированного логирования, которая обеспечивает полную трассировку операций через все архитектурные слои приложения с помощью корреляционных ID, контекстной информации и стандартизированного формата.

---

## 📋 Ключевые принципы

### 1️⃣ Структурированность

Каждый лог содержит предсказуемую структуру:
```
[LEVEL] TIMESTAMP [LAYER] COMPONENT.OPERATION: MESSAGE | Context: {...} | Meta: {...}
```

**Преимущество:** Логи легко парсить, анализировать и интегрировать с внешними системами.

### 2️⃣ Архитектурная осведомленность

Логирование отражает архитектуру приложения:
- **PRESENTATION** — обработчики ботов
- **APPLICATION** — use cases и сервисы
- **DOMAIN** — бизнес-логика
- **INFRASTRUCTURE** — репозитории и внешние сервисы
- **CROSS_CUTTING** — события и уведомления

**Преимущество:** Быстро определить, где произошла проблема.

### 3️⃣ Трассируемость

Корреляционный ID связывает все логи одной операции:
```
register_123456789_1635000000000
```

**Преимущество:** Отследить полный путь операции от ввода до БД.

### 4️⃣ Контекстность

Каждый лог содержит контекст операции:
```typescript
{
  correlationId: 'register_123456789_1635000000000',
  telegramId: 123456789,
  userId: 'user_456',
  executionTimeMs: 245
}
```

**Преимущество:** Полная информация для отладки без дополнительных запросов.

### 5️⃣ Производительность

Минимальные накладные расходы:
- DEBUG логи выводятся только в разработке
- Структурирование происходит один раз
- Асинхронная отправка в внешние системы

**Преимущество:** Не замедляет приложение.

---

## 🚀 Быстрый старт

### Создание логгера

```typescript
import { LoggerFactory } from '../../shared/layer-logger.js';

// По слоям архитектуры
const logger = LoggerFactory.bot('handler-name');
const logger = LoggerFactory.useCase('operationName');
const logger = LoggerFactory.service('service-name');
const logger = LoggerFactory.repository('repo-name');
const logger = LoggerFactory.external('service-name');
```

### Логирование операции

```typescript
const correlationId = `register_${telegramId}_${Date.now()}`;

logger.info('registerUser', 'User registration started',
  { telegramId, name },
  { correlationId, telegramId }
);

try {
  const user = await registerUser(telegramId, name);
  logger.info('registerUser', 'User registered successfully',
    { userId: user.id },
    { correlationId }
  );
} catch (error) {
  logger.error('registerUser', 'Registration failed',
    error as Error,
    { telegramId },
    { correlationId }
  );
  throw error;
}
```

---

## 📊 Уровни логирования

| Уровень | Когда | Пример |
|---------|-------|--------|
| **INFO** | Успех, начало | `logger.info('registerUser', 'User registered', { userId })` |
| **WARN** | Бизнес-правило не пройдено | `logger.warn('joinGame', 'Player already joined', { playerId })` |
| **ERROR** | Ошибка, исключение | `logger.error('registerUser', 'Failed', error, { telegramId })` |
| **DEBUG** | Детали (только разработка) | `logger.debug('upsertUser', 'Database operation', { table })` |

---

## ✅ Лучшие практики

### Делайте ✅

```typescript
// Используйте корреляционные ID
const correlationId = `register_${telegramId}_${Date.now()}`;
logger.info('operation', 'Message', { data }, { correlationId });

// Логируйте начало и конец операции
logger.info('operation', 'Started', { data }, { correlationId });
// ... выполнение ...
logger.info('operation', 'Completed', { result }, { correlationId });

// Включайте контекстную информацию
logger.info('joinGame', 'Player joined', { playerId, gameId }, { correlationId });

// Используйте правильные уровни
logger.info('success', 'Operation completed');
logger.warn('warning', 'Unexpected but handled');
logger.error('error', 'Operation failed', error);

// Структурируйте метаданные
logger.info('operation', 'Message', { userId, gameId, status });
```

### Не делайте ❌

```typescript
// Не используйте console.log
console.log('User registered:', user);

// Не логируйте весь объект
logger.info('joinGame', 'Player joined', { player: playerObject });

// Не забывайте корреляционный ID
logger.info('operation', 'Something happened', { data });

// Не логируйте чувствительные данные
logger.info('payment', 'Payment processed', { cardNumber: '1234-5678-9012-3456' });

// Не создавайте новый логгер каждый раз
const logger = LoggerFactory.bot('handler');
logger.info('operation', 'Message');
```

---

## 🔍 Отладка

### Поиск операции по корреляционному ID

```bash
grep "register_123456789_" logs.txt
```

Результат покажет весь путь операции через все слои.

### Поиск медленных операций

```bash
grep "Duration:" logs.txt | grep -E "Duration: [0-9]{4,}"
```

Найдет операции, выполнявшиеся дольше 1000ms.

### Поиск ошибок пользователя

```bash
grep "telegramId.*123456789" logs.txt | grep "\[ERROR\]"
```

---

## 📁 Структура документации

| Документ | Для кого | Содержание |
|----------|----------|-----------|
| **ENHANCED_CONSOLE_LOGGER_PRINCIPLES.md** | Все разработчики | Полное руководство с примерами |
| **LOGGER_QUICK_REFERENCE.md** | Новые разработчики | Быстрая шпаргалка |
| **LOGGER_IMPLEMENTATION_GUIDE.md** | Tech leads | Фазы внедрения и оптимизация |
| **LOGGER_SUMMARY.md** | Все | Этот документ — резюме |

---

## 🎓 Примеры по слоям

### Presentation Layer (Bot Handler)

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

### Application Layer (Use Case)

```typescript
import { LoggerFactory } from '../shared/layer-logger.js';

export async function registerUser(telegramId: number, name: string) {
  const logger = LoggerFactory.useCase('registerUser');
  const correlationId = `register_${telegramId}_${Date.now()}`;

  logger.info('registerUser', 'Processing user registration request',
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
    logger.error('registerUser', 'Failed to register user',
      error as Error,
      { telegramId },
      { correlationId }
    );
    throw error;
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

  async upsertUser(data: { telegramId: number; name: string }) {
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
      this.logger.debug('upsertUser', 'User upserted successfully',
        { userId: user.id, duration }
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

## 🔗 Интеграция с внешними системами

### Текущее состояние

В production режиме ERROR логи отправляются на внешний сервис логирования:

```typescript
if (process.env.NODE_ENV === 'production' && entry.level === 'ERROR') {
  this.sendToExternalService(entry);
}
```

### Рекомендуемые системы

- **Sentry** — отслеживание ошибок (рекомендуется для MVP)
- **CloudWatch** — централизованное логирование (AWS)
- **DataDog** — мониторинг и аналитика
- **ELK Stack** — поиск и анализ логов
- **Grafana Loki** — логирование и мониторинг

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

## 🎯 Текущий статус проекта

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

## 💡 Ключевые преимущества

✅ **Структурированность** — предсказуемый формат логов  
✅ **Трассируемость** — корреляционные ID для отслеживания операций  
✅ **Архитектурная осведомленность** — логирование по слоям  
✅ **Контекстность** — полная информация о каждой операции  
✅ **Производительность** — минимальные накладные расходы  
✅ **Масштабируемость** — готовность к интеграции с внешними системами  
✅ **Простота использования** — единообразный API через LoggerFactory  

---

## 🔗 Ссылки

- 📖 [Полная документация](ENHANCED_CONSOLE_LOGGER_PRINCIPLES.md)
- 📄 [Быстрая шпаргалка](LOGGER_QUICK_REFERENCE.md)
- 📋 [Руководство внедрения](LOGGER_IMPLEMENTATION_GUIDE.md)
- 💻 [Исходный код EnhancedConsoleLogger](../src/shared/enhanced-logger.ts)
- 💻 [Исходный код LayerLogger](../src/shared/layer-logger.ts)
- 📚 [Система логирования](enhanced-logging-system.md)

---

## 🎓 Для новых разработчиков

1. **Прочитайте** [LOGGER_QUICK_REFERENCE.md](LOGGER_QUICK_REFERENCE.md) (5 минут)
2. **Посмотрите примеры** в [ENHANCED_CONSOLE_LOGGER_PRINCIPLES.md](ENHANCED_CONSOLE_LOGGER_PRINCIPLES.md) (15 минут)
3. **Используйте** LoggerFactory в своем коде
4. **Спросите** у team lead, если что-то непонятно

---

## 📞 Поддержка

- 📖 Документация: `/documentation`
- 💻 Исходный код: `/src/shared/`
- 🐛 Проблемы: GitHub Issues
- 💬 Вопросы: Team Slack

---

**Последнее обновление:** 2025-11-18  
**Версия:** 1.0  
**Статус:** Production Ready ✅
