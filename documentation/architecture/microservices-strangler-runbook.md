# Strangler Fig: порядок выноса сервисов

Согласовано с [microservices-inventory.md](microservices-inventory.md) и ADR в [adr/](adr/).

## Целевой порядок

1. **notification-worker** + outbox → RabbitMQ (уже есть заготовки `apps/notification-worker`, `apps/outbox-publisher`, таблица `messaging_outbox`).
2. **scheduler-service** (BullMQ workers отдельно от gateway).
3. **matching-service** (профиль и расписание подбора по виду спорта).
4. **user-service**.
5. **game-service** (ядро волейбола).

## Docker Compose (локально)

Сервисы `rabbitmq`, `outbox-publisher`, `notification-worker` в [docker-compose.yml](../../docker-compose.yml). Переменные:

- `RABBITMQ_URL` — для publisher и worker.
- `OUTBOX_RECORD_ENABLED=true` — запись в `messaging_outbox` в **той же транзакции**, что и мутации домена (join/leave/markPayment и др.), затем outbox-publisher → RabbitMQ; in-process handlers выполняются **после коммита** (`EventBus.dispatchHandlers`).

## S2S и internal HTTP

- Сервисы вызывают read API монолита с префиксом `/internal` и заголовком `Authorization: Bearer <INTERNAL_API_TOKEN>`.
- В проде: секреты из Vault/Kubernetes Secrets, отдельные токены на клиента, ротация. Спецификация: [internal-read-api.yaml](../../openapi/internal-read-api.yaml).

## Откат

Отключить publisher/worker, `OUTBOX_RECORD_ENABLED=false`, монолит продолжает работать как раньше.
