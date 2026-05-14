# Strangler Fig: порядок выноса сервисов

Согласовано с [microservices-inventory.md](microservices-inventory.md) и ADR в [adr/](adr/).

## Целевой порядок

1. **notification-worker** + outbox → RabbitMQ (уже есть заготовки `apps/notification-worker`, `apps/outbox-publisher`, таблица `messaging_outbox`).
2. **scheduler-service** (BullMQ workers отдельно от gateway).
3. **matching-service** (ракеточный профиль).
4. **user-service**.
5. **game-service** (ядро волейбола).

## Docker Compose (локально)

Сервисы `rabbitmq`, `outbox-publisher`, `notification-worker` в [docker-compose.yml](../../docker-compose.yml). Переменные:

- `RABBITMQ_URL` — для publisher и worker.
- `OUTBOX_RECORD_ENABLED=true` — запись строк в outbox после успешной обработки in-process handlers (см. `EventBus.publish`).

## Откат

Отключить publisher/worker, `OUTBOX_RECORD_ENABLED=false`, монолит продолжает работать как раньше.
