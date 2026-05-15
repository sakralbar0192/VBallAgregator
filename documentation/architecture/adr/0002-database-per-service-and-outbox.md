# ADR 0002: Database-per-service, transactional outbox и миграции

## Статус

Принято (2026-05-14).

## Контекст

Нужно вынести обработку за пределы одного процесса, сохранив порядок и идемпотентность. Выбран **RabbitMQ** и отдельные БД на сервис.

## Решение

### Целевое состояние

- Каждый доменный сервис имеет **свою** PostgreSQL (отдельный `DATABASE_URL`).
- Межсервисная консистентность: **transactional outbox** в БД владельца события + процесс **outbox-publisher** → RabbitMQ.
- Временный мост: несколько схем в **одной** инстанции Postgres допустим только на этапе cutover, не как финал.

### Таблица outbox (монолит / game-service до split)

Модель `MessagingOutbox` в текущей схеме (`packages/core/prisma/schema.prisma`):

- Хранит каноническое тело события для внешних потребителей.
- Поля: `eventType`, `schemaVersion`, `aggregateId`, `correlationId`, `payload` (JSON), `occurredAt`, `publishedAt` (null пока не отправлено в RabbitMQ).

Процесс `apps/outbox-publisher` читает неопубликованные строки, публикует в exchange `vball.domain` (topic) с **publisher confirms**, выставляет `publishedAt` только после ack брокера.

### Синхронные вызовы

- Внутренние сервисы: **HTTP + OpenAPI**; аутентификация S2S (mTLS или JWT) — отдельный ADR при внедрении.

### Миграция данных

1. Зафиксировать владельца каждой таблицы (см. ADR 0001).
2. Создать пустые БД новых сервисов и Prisma-схемы (по одной на сервис).
3. Одноразовый **copy** + dual-read (опционально) + cutover по фичефлагу.
4. Удалить таблицы из монолита после стабилизации.

## Последствия

- Увеличение операционной сложности (несколько БД, брокер, publisher).
- Задержка доставки событий между запись в БД и потребителем (секунды), нужны **идемпотентные** consumer’ы.

## Реализация в репозитории

- Онбординг и Telegram UI остаются в процессе gateway; владение данными следует ADR 0001: **`User`**, **`UserSportProfile`** — user-контур; **`MatchingProfile`**, **`MatchingSchedule`** — matching-контур (сейчас в одной Prisma-схеме, ключи по **`sport`** готовят split).
- Outbox: `packages/core/prisma/schema.prisma` → `MessagingOutbox`.
- Publisher: `apps/outbox-publisher/`.
- Envelope: `packages/shared-kernel/`.

## RabbitMQ: прод-конвейер (политики)

Значения ниже — **базовая договорённость** для стендов и prod; при необходимости переопределяются env/IaC без смены контракта сообщений.

### Publisher (`outbox-publisher`)

- Канал **publisher confirms** (`confirmSelect`): поле `publishedAt` в БД выставляется **только после** broker ack на publish. При nack/ошибке строка остаётся с `publishedAt = null` и попадёт в следующий poll.
- Routing: exchange `vball.domain` (topic, durable), routing key = `eventType`. В заголовках сообщения передаётся `x-outbox-id` = id строки outbox для идемпотентности downstream.

### Consumers (например `notification-worker`)

- Очередь **durable**; аргументы **DLQ**: `x-dead-letter-exchange` + `x-dead-letter-routing-key` на отдельный exchange/очередь для ручного разбора; poison message — `nack(requeue=false)` → DLQ.
- **Prefetch** (`prefetch`): по умолчанию 20 (настраивается), чтобы ограничить незавершённые unacked.
- Ретраи: короткие повторы через задержку + `nack(requeue=true)` с ограничением попыток; после лимита — DLQ (или TTL + DLX).
- **Лимит длины очереди** (`x-max-length`, опционально через env): политика overflow `reject-publish` на стороне брокера — согласовать с мониторингом; альтернатива — только алерты по глубине очереди без жёсткого cap.

### Идемпотентность

- Consumer хранит обработанные ключи `(eventType, aggregateId, occurredAt)` или `x-outbox-id` в Redis/таблице с TTL.
- Дубликаты при at-least-once delivery не должны приводить к повторным побочным эффектам (Telegram и т.д.).
