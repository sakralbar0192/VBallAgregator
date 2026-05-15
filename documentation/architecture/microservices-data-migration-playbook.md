# Playbook: миграция данных при DB-per-service

Дополняет [adr/0002-database-per-service-and-outbox.md](adr/0002-database-per-service-and-outbox.md).

## Принципы

1. **Один источник правды** на таблицу в любой момент времени (до cutover — монолит).
2. **UUID** наружу между сервисами не менять.
3. **Outbox** пишется только владельцем агрегата в той же транзакции, что и бизнес-изменение (цель; в монолите первый шаг — запись outbox в `EventBus.publish` как задел, затем перенос в транзакции use case).

## Порядок cutover (пример для `matching-service`)

1. Поднять БД `matching_db` и сервис с Prisma-схемой только `MatchingProfile` + `MatchingSchedule`.
2. Остановить запись в монолит по фичефлагу для теннисного wizard → dual-write в монолит + matching_db.
3. Скопировать исторические строки одноразовым job.
4. Переключить чтение на matching_db.
5. Удалить таблицы из монолита после окна наблюдения.

## Saga (пример: join → уведомление → напоминание)

- Локально: `game-service` фиксирует регистрацию и пишет outbox `PlayerJoined`.
- `notification-service` потребляет событие, запрашивает read API user/game при необходимости, шлёт Telegram.
- `scheduler-service` потребляет то же или отдельное `ReminderScheduled` после успешной постановки джоба.

## Откат

Фичефлаг «трафик только монолит»; outbox-публикация отключается `OUTBOX_PUBLISHER_ENABLED=false`.
