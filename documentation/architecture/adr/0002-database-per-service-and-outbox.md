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

Процесс `apps/outbox-publisher` читает неопубликованные строки, публикует в exchange `vball.domain` (topic), выставляет `publishedAt`.

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

- Outbox: `packages/core/prisma/schema.prisma` → `MessagingOutbox`.
- Publisher: `apps/outbox-publisher/`.
- Envelope: `packages/shared-kernel/`.
