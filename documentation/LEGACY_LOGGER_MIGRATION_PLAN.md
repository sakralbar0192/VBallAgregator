# План миграции с ConsoleLogger на EnhancedConsoleLogger

## 📋 Обзор

Необходимо заменить использование старого `ConsoleLogger` из [`src/shared/logger.ts`](../src/shared/logger.ts) на новую систему `EnhancedConsoleLogger` с использованием `LoggerFactory`.

---

## 📊 Статистика использования

### Файлы, использующие старый logger

**Прямой импорт `logger` из `src/shared/logger.js`:**
- `src/api/server.ts` — 3 использования
- `src/application/services/game-service.ts` — 2 использования
- `src/shared/notification-service.ts` — 3 использования
- `src/shared/idempotency-service.ts` — 4 использования
- `src/shared/scheduler-service.ts` — 11 использований
- `src/shared/rate-limiter.ts` — 4 использования
- `src/shared/event-bus.ts` — 3 использования
- `src/shared/enhanced-notification-service.ts` — 8 использований
- `src/shared/user-preferences-service.ts` — 5 использований
- `src/shared/scheduler.ts` — 11 использований

**Итого:** 10 файлов, ~54 использования

### Файлы, использующие новый LoggerFactory

**Уже мигрированы:**
- Все bot handlers (12+)
- Все use cases (20+)
- Все application services (5+)
- Все repositories (5+)
- Event handlers

---

## 🎯 Стратегия миграции

### Фаза 1: Критичные компоненты (API и сервисы)

**Файлы:**
1. `src/api/server.ts` — API сервер
2. `src/application/services/game-service.ts` — Бизнес-логика игр

**Действие:** Заменить на `LoggerFactory.external()` или `LoggerFactory.service()`

### Фаза 2: Инфраструктурные сервисы

**Файлы:**
1. `src/shared/notification-service.ts` — Отправка уведомлений
2. `src/shared/enhanced-notification-service.ts` — Расширенные уведомления
3. `src/shared/event-bus.ts` — Шина событий
4. `src/shared/scheduler.ts` — Планировщик задач
5. `src/shared/scheduler-service.ts` — Сервис планирования

**Действие:** Заменить на `LoggerFactory.external()`

### Фаза 3: Утилиты и сервисы

**Файлы:**
1. `src/shared/rate-limiter.ts` — Rate limiter
2. `src/shared/idempotency-service.ts` — Idempotency
3. `src/shared/user-preferences-service.ts` — Предпочтения пользователя

**Действие:** Заменить на `LoggerFactory.external()`

---

## 🔄 Процесс замены

### Шаблон замены

**Было:**
```typescript
import { logger } from './logger.js';

logger.info('Message', { data });
logger.warn('Message', { data });
logger.error('Message', { data });
```

**Стало:**
```typescript
import { LoggerFactory } from './layer-logger.js';

const logger = LoggerFactory.external('component-name');

logger.info('operation', 'Message', { data });
logger.warn('operation', 'Message', { data });
logger.error('operation', 'Message', { data }, error);
```

### Правила замены

1. **Импорт:** Заменить `import { logger } from './logger.js'` на `import { LoggerFactory } from './layer-logger.js'`
2. **Инициализация:** Создать логгер через `LoggerFactory.external('component-name')`
3. **Вызовы:** Добавить `operation` как первый параметр
4. **Ошибки:** Передать объект Error как третий параметр для `error()`

---

## 📝 Чек-лист миграции

### Фаза 1: API и сервисы

- [ ] **src/api/server.ts**
  - [ ] Заменить импорт
  - [ ] Создать логгер через LoggerFactory.external('api-server')
  - [ ] Обновить вызовы logger.info/error
  - [ ] Протестировать

- [ ] **src/application/services/game-service.ts**
  - [ ] Заменить импорт
  - [ ] Создать логгер через LoggerFactory.service('game-service')
  - [ ] Обновить вызовы logger.info
  - [ ] Протестировать

### Фаза 2: Инфраструктурные сервисы

- [ ] **src/shared/notification-service.ts**
  - [ ] Заменить импорт
  - [ ] Создать логгер через LoggerFactory.external('notification-service')
  - [ ] Обновить вызовы (3 использования)
  - [ ] Протестировать

- [ ] **src/shared/enhanced-notification-service.ts**
  - [ ] Заменить импорт
  - [ ] Создать логгер через LoggerFactory.external('enhanced-notification-service')
  - [ ] Обновить вызовы (8 использований)
  - [ ] Протестировать

- [ ] **src/shared/event-bus.ts**
  - [ ] Заменить импорт
  - [ ] Создать логгер через LoggerFactory.external('event-bus')
  - [ ] Обновить вызовы (3 использования)
  - [ ] Протестировать

- [ ] **src/shared/scheduler.ts**
  - [ ] Заменить импорт
  - [ ] Создать логгер через LoggerFactory.external('scheduler')
  - [ ] Обновить вызовы (11 использований)
  - [ ] Протестировать

- [ ] **src/shared/scheduler-service.ts**
  - [ ] Заменить импорт
  - [ ] Создать логгер через LoggerFactory.external('scheduler-service')
  - [ ] Обновить вызовы (11 использований)
  - [ ] Протестировать

### Фаза 3: Утилиты

- [ ] **src/shared/rate-limiter.ts**
  - [ ] Заменить импорт
  - [ ] Создать логгер через LoggerFactory.external('rate-limiter')
  - [ ] Обновить вызовы (4 использования)
  - [ ] Протестировать

- [ ] **src/shared/idempotency-service.ts**
  - [ ] Заменить импорт
  - [ ] Создать логгер через LoggerFactory.external('idempotency-service')
  - [ ] Обновить вызовы (4 использования)
  - [ ] Протестировать

- [ ] **src/shared/user-preferences-service.ts**
  - [ ] Заменить импорт
  - [ ] Создать логгер через LoggerFactory.external('user-preferences-service')
  - [ ] Обновить вызовы (5 использований)
  - [ ] Протестировать

### Финальные шаги

- [ ] Проверить, что все файлы обновлены
- [ ] Запустить тесты
- [ ] Проверить логирование в разработке
- [ ] Удалить старый `src/shared/logger.ts`
- [ ] Обновить документацию

---

## 🔍 Примеры замены

### Пример 1: API Server

**Было:**
```typescript
import { logger } from '../shared/logger.js';

const closeGracefully = async (signal: string) => {
  logger.info(`Received signal ${signal}, closing server gracefully`);
  await fastify.close();
};

logger.info(`API server listening on ${address}`);

logger.error('Failed to start API server', { error: err });
```

**Стало:**
```typescript
import { LoggerFactory } from '../shared/layer-logger.js';

const logger = LoggerFactory.external('api-server');

const closeGracefully = async (signal: string) => {
  logger.info('closeGracefully', `Received signal ${signal}, closing server gracefully`);
  await fastify.close();
};

logger.info('start', `API server listening on ${address}`);

logger.error('start', 'Failed to start API server', err, { error: err.message });
```

### Пример 2: Notification Service

**Было:**
```typescript
import { logger } from './logger.js';

logger.info('Notification sent', {
  chatId,
  messageId: response.message_id,
  timestamp: new Date().toISOString()
});

logger.error('Permanent notification error', {
  chatId,
  error: error.message
});

logger.warn('Temporary notification error', {
  chatId,
  error: error.message
});
```

**Стало:**
```typescript
import { LoggerFactory } from './layer-logger.js';

const logger = LoggerFactory.external('notification-service');

logger.info('sendMessage', 'Notification sent', {
  chatId,
  messageId: response.message_id,
  timestamp: new Date().toISOString()
});

logger.error('sendMessage', 'Permanent notification error', error, {
  chatId,
  error: error.message
});

logger.warn('sendMessage', 'Temporary notification error', {
  chatId,
  error: error.message
});
```

### Пример 3: Event Bus

**Было:**
```typescript
import { logger } from './logger.js';

logger.info('Publishing event via EventBus', { eventType: event.type, eventId: event.id });

logger.error('Event processing failures', {
  eventType: event.type,
  failureCount: failures.length
});

logger.warn('Event handler failed', {
  eventType: event.type,
  handlerName: handler.name
});
```

**Стало:**
```typescript
import { LoggerFactory } from './layer-logger.js';

const logger = LoggerFactory.external('event-bus');

logger.info('publish', 'Publishing event via EventBus', { eventType: event.type, eventId: event.id });

logger.error('publish', 'Event processing failures', error, {
  eventType: event.type,
  failureCount: failures.length
});

logger.warn('handleEvent', 'Event handler failed', {
  eventType: event.type,
  handlerName: handler.name
});
```

---

## ⏱️ Оценка времени

| Фаза | Файлы | Использования | Время |
|------|-------|---------------|-------|
| **Фаза 1** | 2 | 5 | 30 мин |
| **Фаза 2** | 5 | 32 | 1.5 часа |
| **Фаза 3** | 3 | 13 | 45 мин |
| **Финал** | - | - | 30 мин |
| **ИТОГО** | 10 | 54 | ~3 часа |

---

## 🚀 Следующие шаги

1. **Выполнить миграцию** по фазам
2. **Протестировать** логирование в разработке
3. **Запустить тесты** для проверки функциональности
4. **Удалить** старый `src/shared/logger.ts`
5. **Обновить** документацию проекта
6. **Создать PR** с описанием изменений

---

## 📚 Ссылки

- [`src/shared/logger.ts`](../src/shared/logger.ts) — Старый логгер (к удалению)
- [`src/shared/enhanced-logger.ts`](../src/shared/enhanced-logger.ts) — Новый логгер
- [`src/shared/layer-logger.ts`](../src/shared/layer-logger.ts) — LoggerFactory
- [`LOGGER_QUICK_REFERENCE.md`](LOGGER_QUICK_REFERENCE.md) — Справочник по использованию
