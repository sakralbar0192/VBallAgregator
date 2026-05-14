# ADR 0001: Bounded contexts и границы микросервисов

## Статус

Принято (2026-05-14).

## Контекст

VBallAgregator — модульный монолит после слияния волейбольного и ракеточного контуров. Целевая архитектура: **database-per-service**, **RabbitMQ** для асинхронных событий, **HTTP + OpenAPI** для синхронных вызовов.

## Решение

### Владельцы данных (сервисы)

| Сервис | Владение данными | Публичный контракт |
|--------|------------------|-------------------|
| **user-service** | `User`, `UserNotificationPreferences` | OpenAPI: CRUD пользователя по `id` / lookup по `telegramId`; настройки уведомлений |
| **organizer-service** (или объединение с user на раннем этапе) | `Organizer`, `PlayerOrganizer` | OpenAPI: связи игрок–организатор, списки подтверждённых игроков |
| **game-service** | `Game`, `Registration`, `GamePlayerResponse` | OpenAPI: жизненный цикл игры, join/leave, оплата на регистрации, инвайты |
| **matching-service** | `MatchingProfile`, `MatchingSchedule` | OpenAPI: профиль и расписание ракеточного подбора |
| **scheduler-service** | не владеет доменными таблицами; Redis/BullMQ | Постановка джобов по командам из game-service (HTTP или события) |
| **notification-service** | минимальные локальные таблицы при необходимости (идемпотентность); не дублировать домен | Подписка на RabbitMQ; отправка Telegram |
| **telegram-gateway** | сессии Telegraf (Redis), без доменной БД | Внешний вход; вызовы внутренних OpenAPI |

**«Толстый» game-service** на переходный период допускает объединение game + registration + payment flags в одной БД до стабилизации контрактов.

### Запрещено

- Прямые запросы из notification/scheduler worker к чужим таблицам после split.
- Синхронные distributed transactions между сервисами — только **saga** / **outbox** + компенсации.

## Последствия

- Потребуются **read models** или синхронные HTTP-запросы для сборки сообщений (например, напоминание об игре).
- `joinGame` и приоритетное окно требуют либо вызовов к organizer-service, либо репликации минимальных фактов событием.

## Связь с кодом

Инвентаризация: [microservices-inventory.md](../microservices-inventory.md).
