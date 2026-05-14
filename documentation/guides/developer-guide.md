# Руководство разработчика

## Обзор

Руководство для разработчиков **VBallAgregator**: мульти-спорт Telegram-бот (волейбол, ракетки), домен игр и регистраций в `packages/core`, UI бота в `packages/bot-volley`, ракеточные сцены в `packages/bot-racket`. Точка входа процесса — [apps/server/index.ts](../../apps/server/index.ts).

**Каноничные обзоры:** [Архитектура реализации](../architecture/implementation-architecture.md) · [Продукт и возможности](../business/product-and-capabilities.md)

## Содержание

- [Начало работы](#начало-работы)
- [Структура проекта](#структура-проекта)
- [Среда разработки](#среда-разработки)
- [Стандарты кодирования](#стандарты-кодирования)
- [Тестирование](#тестирование)
- [База данных](#база-данных)
- [Разработка бота](#разработка-бота)
- [Участие в разработке](#участие-в-разработке)

## Начало работы

### Предварительные требования

- Node.js 20+ (в CI зафиксировано 20; локально желательно не ниже 18)
- TypeScript
- Docker и Docker Compose (PostgreSQL, Redis)
- Telegram Bot Token

### Установка

1. Клонировать репозиторий
2. `npm ci`
3. Скопировать `.env.example` в `.env`, задать `TELEGRAM_BOT_TOKEN`, `DATABASE_URL`, при необходимости `API_PORT` (по умолчанию в примере `3001`)
4. Поднять БД и Redis: `npm run docker:up` или свой стенд
5. Миграции: `npm run prisma:migrate` (или `npm run prisma:deploy` на стенде)
6. Клиент Prisma: `npm run prisma:generate`
7. Запуск: `npm run dev`

## Структура проекта

```
apps/
└── server/
    └── index.ts          # Точка входа: бот, API, scheduler, event bus

packages/
├── core/
│   ├── prisma/           # schema.prisma, migrations
│   └── src/
│       ├── api/          # Fastify HTTP API
│       ├── application/ # Use cases, application services
│       ├── domain/       # Доменные модели и правила
│       ├── infrastructure/
│       ├── shared/       # Конфиг, логирование, event bus, scheduler
│       └── tests/        # Jest-тесты (unit / integration / e2e)
├── bot-volley/
│   └── src/bot/          # Telegraf: create-bot, modules, handlers
└── bot-racket/
    └── src/
        ├── racket-scenes.ts
        └── profile-setup/  # Wizard ракеточного профиля

Корень репозитория: package.json, tsconfig.json, jest.config.js, docker-compose.yml
```

### Ключевые директории

| Область | Путь |
|---------|------|
| Use cases и домен | `packages/core/src/application`, `packages/core/src/domain` |
| Prisma | `packages/core/prisma/schema.prisma` |
| Регистрация команд и callback | `packages/bot-volley/src/bot/modules`, `.../handlers` |
| Ракеточные сцены | `packages/bot-racket/src` |

## Среда разработки

### Переменные окружения

Ориентир — [.env.example](../../.env.example). Минимум:

```env
DATABASE_URL="postgresql://user:password@localhost:5434/vball_db"
TELEGRAM_BOT_TOKEN="your_bot_token"
API_PORT=3001
```

Дополнительно: Redis (`REDIS_HOST`, `REDIS_PORT`, при необходимости пароль), таймзона и локаль из примера.

### База данных

- Миграции разработки: `npm run prisma:migrate`
- Деплой миграций: `npm run prisma:deploy`
- Studio: `npm run prisma:studio`

Отдельного скрипта `db:seed` в корневом `package.json` нет — засев данных делайте вручную или через свои скрипты.

## Стандарты кодирования

См. [Стандарты кодирования](../development/coding-standards.md).

## Тестирование

См. [Стратегия тестирования](../development/testing-strategy.md).

### Запуск

| Команда | Назначение |
|---------|------------|
| `npm run test` | unit-integration (с покрытием) + e2e |
| `npm run test:unit` | без файлов `*.integration.test.ts` |
| `npm run test:integration` | узкий набор integration |
| `npm run test:e2e` | e2e-проект |
| `npm run test:ci` | CI-режим с `SKIP_INTEGRATION_TESTS` |

Тесты и `jest.config` подхватывают и `packages/bot-racket/src/**/*.test.ts`.

## База данных

Схема: [packages/core/prisma/schema.prisma](../../packages/core/prisma/schema.prisma). Основные сущности: `User` (в т.ч. `activeSport`, `levelTag`), `Game`, `Registration`, `Organizer`, `MatchingProfile`, `MatchingSchedule`, и др. Подробнее — [data-model.md](../architecture/data-model.md).

## Разработка бота

- Сборка бота: [packages/bot-volley/src/bot/create-bot.ts](../../packages/bot-volley/src/bot/create-bot.ts) — `session`, `Stage`, модули из `BotModuleRegistry`.
- Новые команды: регистрация в соответствующем модуле в `packages/bot-volley/src/bot/modules/`.
- Ракеточный wizard: [packages/bot-racket/src/profile-setup/](../../packages/bot-racket/src/profile-setup/) — при изменении шагов проверять вызов **`next()`** для не-callback апдейтов в `WizardScene` (см. [implementation-architecture.md](../architecture/implementation-architecture.md)).

Список модулей и паттерны — [modules.md](../architecture/modules.md).

## Участие в разработке

См. [workflow.md](../development/workflow.md).

### Команды из package.json

```bash
npm run dev          # tsx apps/server/index.ts + dotenv
npm run build        # tsc
npm run lint         # eslint
npm run prisma:migrate
npm run prisma:generate
npm run test
```

## Устранение неполадок

- **БД:** проверить `DATABASE_URL`, миграции, доступность Postgres.
- **Бот не отвечает:** токен, сеть до `api.telegram.org`, не застрял ли пользователь в сцене без `next()` (см. архитектурный документ), rate limit в `create-bot.ts`.
- **Миграции:** конфликты схемы, `prisma migrate status`.

## Ресурсы

- [Архитектура реализации](../architecture/implementation-architecture.md)
- [Справочник API](../architecture/api-reference.md)
- [Стратегия тестирования](../development/testing-strategy.md)
- [Логирование](../development/comprehensive-logging-guide.md)

**Последнее обновление:** 2026-05-14
