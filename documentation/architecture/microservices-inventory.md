# Инвентаризация для микросервисной декомпозиции

Документ фиксирует **as-is** связи кода с каналами, use cases, событиями, очередями и таблицами БД. Обновлять при значимых изменениях домена.

## 1. Входные каналы

| Канал | Реализация | Назначение |
|-------|------------|------------|
| Telegram (long polling) | `apps/server` → `createBot` (`packages/bot-volley`) | Основной UI: команды, callback, сцены `packages/bot-racket` |
| HTTP | `packages/core/src/api` (Fastify) | Health, диагностика; не заменяет Telegram |

## 2. Use cases и точки входа (application)

Источник: `packages/core/src/application/use-cases.ts` (экспортируемые async-функции), вызовы из `packages/bot-volley` (handlers, command-handlers).

Основные сценарии (неполный список — сверять с файлом): `joinGame`, `leaveGame`, `createGame`, `closeGame`, `markPayment`, отмена регистрации, приглашения, публикация игры и др. Полный перечень: поиск по шаблону `export async function` в `use-cases.ts`.

## 3. Доменные события (in-process EventBus)

**Типы** (каноничный union): `packages/core/src/shared/types.ts` — `DomainEvent`.

**Подписчики** (обработка + Prisma/Telegram): `packages/core/src/shared/event-handlers.ts`

| Тип события | Подписчик зарегистрирован |
|-------------|---------------------------|
| `GameReminder24h` | да |
| `GameReminder2h` | да |
| `PaymentReminder12h` | да |
| `PaymentReminder24h` | да |
| `SendPaymentReminders` | да |
| `PlayerJoined` | да |
| `WaitlistedPromoted` | да |
| `PaymentMarked` | да |
| `RegistrationCanceled` | да |
| `GameClosed` | да |
| `PlayerLinkedToOrganizer` | да |
| `PaymentAttemptRejectedEarly` | да |
| `PlayerSelectedOrganizers` | да |
| `PlayerConfirmedByOrganizer` | да |
| `PlayerRejectedByOrganizer` | да |
| `GameCreatedWithPriorityWindow` | да |
| `PlayerRespondedToGameInvitation` | да |
| `GamePublishedForAll` | да |

**Публикация** (поиск по репозиторию `eventBus.publish`):

- `packages/core/src/application/use-cases.ts`
- `packages/core/src/application/services/game-service.ts`
- `packages/core/src/application/services/invitation-service.ts`
- `packages/core/src/application/services/organizer-service.ts`
- `packages/core/src/shared/scheduler-service.ts`
- `packages/core/src/shared/scheduler.ts` (workers BullMQ → EventBus)

## 4. Фоновые джобы (BullMQ)

Источник: `packages/core/src/shared/scheduler-service.ts`

| Очередь Redis | Назначение джоба |
|---------------|------------------|
| `game-reminders` | 24h / 2h напоминания об игре |
| `payment-reminders` | 12h / 24h после старта (логика в коде) |
| `priority-window-checks` | проверка окон приоритета |

Исполнение воркеров инициализируется в `SchedulerService.initializeWorkers`, публикация в EventBus — в `packages/core/src/shared/scheduler.ts`.

## 5. Матрица Prisma-модель → основные читатели/писатели

Легенда: **core** = `packages/core/src`; **bot-v** = `packages/bot-volley`; **bot-r** = `packages/bot-racket`.

| Модель Prisma | Писатели / тяжёлые читатели |
|---------------|----------------------------|
| `User` | core repos, `user-service` use cases, `user-preferences-service`, bot handlers (`command-handlers`, `profile-handler`, `common-handlers`, …), `game-creation-wizard`, `profile-setup-persist` (bot-r) |
| `Organizer` | `organizer-repository`, `organizer-service`, `game-service` (upsert), bot handlers |
| `Game` | `game-repository`, `game-service`, `invitation-service`, queries, `use-cases`, bot `command-handlers` |
| `Registration` | `registration-repository`, `use-cases`, queries, bot |
| `UserNotificationPreferences` | `user-preferences-service`, tests |
| `PlayerOrganizer` | `organizer-service`, `use-cases` (join priority), tests |
| `GamePlayerResponse` | invitation / use-cases / tests |
| `MatchingProfile`, `MatchingSchedule` | `profile-setup-persist` (bot-r), tests |

**Запрещено при DB-per-service:** прямые SQL/join между БД разных сервисов; кросс-чтение только через **публичный HTTP API** или **события RabbitMQ** (после внедрения outbox).

## 6. Транзакции

Использование `prisma.$transaction` и критичные атомарные блоки — искать по `$transaction` в `packages/core`. Кандидаты на локальный ACID внутри `game-service` после split: `leaveGame`, массовые обновления регистраций.

---

**Связанные документы:** [adr/0001-bounded-contexts-and-services.md](adr/0001-bounded-contexts-and-services.md), [adr/0002-database-per-service-and-outbox.md](adr/0002-database-per-service-and-outbox.md), [microservices-data-migration-playbook.md](microservices-data-migration-playbook.md), [microservices-strangler-runbook.md](microservices-strangler-runbook.md).
