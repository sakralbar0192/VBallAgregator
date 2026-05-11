# Getting Started - Быстрый старт для разработчиков VBallAgregator

> **Время чтения:** 5 минут  
> **Цель:** Понять проект и начать разработку за минимальное время

## 🎯 Что такое VBallAgregator

**VBallAgregator** — это Telegram-бот для автоматизации организации волейбольных игр. Система помогает игрокам находить подходящие игры, а организаторам — управлять набором участников, отслеживать оплаты и координировать проведение игр.

### Ключевые возможности:
- 🤖 **Умная регистрация**: Приоритетная запись для "своих" игроков
- 🎮 **Управление играми**: Создание, запись, отмена через Telegram
- 💰 **Отслеживание оплат**: Ручная отметка с напоминаниями
- 👥 **Отношения игрок-организатор**: Система привязки и подтверждений
- 🔔 **Автоматические уведомления**: Напоминания об играх и оплатах

## 🏗️ Архитектура в двух словах

### Технологический стек:
- **Backend**: Node.js + TypeScript + Telegraf (Telegram Bot API)
- **База данных**: PostgreSQL + Prisma ORM
- **Кэш и очереди**: Redis + BullMQ
- **API**: Fastify для REST endpoints
- **Контейнеризация**: Docker + docker-compose

### Архитектурные слои:
```
🤖 Bot Layer (Telegram) → 🧠 Application Layer (Бизнес-логика) → 🏗️ Domain Layer (Модели) → 🗄️ Infrastructure (БД/Redis)
```

## 📁 Структура проекта

```
📁 src/
├── 🤖 bot/                    # Telegram Bot handlers
│   ├── 📁 modules/            # Модули (Registration, GameManagement, etc.)
│   ├── 📁 registration/       # Регистрация пользователей
│   ├── 📁 game-management/    # Управление играми
│   ├── 📁 payments/          # Обработка платежей
│   └── 📁 common/            # Общие компоненты
├── 🧠 application/           # Use cases и сервисы
│   ├── 📁 services/          # Бизнес-сервисы
│   └── 📁 queries/           # Специализированные запросы
├── 🏗️ domain/               # Доменные модели
│   ├── 📁 errors/            # Система ошибок
│   └── 📁 services/          # Доменные сервисы
├── 🗄️ infrastructure/       # Внешние интеграции
│   ├── 📁 repositories/      # Репозитории данных
│   └── 📁 prisma.ts         # Database client
└── 🔧 shared/               # Общие компоненты
    ├── 📁 config.ts         # Конфигурация
    ├── 📁 logger.ts         # Система логирования
    └── 📁 types.ts          # Общие типы
```

## ⚡ Быстрый старт разработки

### 1. Предварительные требования
```bash
# Необходимо установить:
- Node.js 20+
- npm (как в CI) или bun
- Docker / Docker Compose v2
- PostgreSQL и Redis (через Docker)
```

### 2. Установка и запуск
```bash
# Клонирование репозитория
git clone git@github.com:sakralbar0192/VBallAgregator.git
cd VBallAgregator

# Установка зависимостей
npm ci

# Запуск инфраструктуры (PostgreSQL, Redis; БД на localhost:5434, имя vball_db)
docker compose up -d db redis

# Настройка переменных окружения
cp .env.example .env
# Укажите TELEGRAM_BOT_TOKEN; при необходимости API_PORT (по умолчанию 3001)

# Настройка базы данных
npm run prisma:migrate
npm run prisma:generate

# Запуск приложения (Telegram-бот + HTTP API с /health)
npm run dev
```

### 3. Проверка работоспособности
```bash
# Проверка health endpoint (порт из API_PORT, по умолчанию 3001)
curl "http://localhost:${API_PORT:-3001}/health"

# Логи — в stdout процесса (отдельный файл logs/app.log не используется)
```

## 🎮 Основные пользовательские сценарии

### Регистрация пользователя:
```
/start → [Выбор роли] → [Выбор уровня] → [Привязка к организатору] → Готов
```

### Создание игры (организатор):
```
/newgame → [Дата] → [Время] → [Уровень] → [Место] → [Вместимость] → [Цена] → Создано
```

### Запись на игру (игрок):
```
/games → [Выбор игры] → [Записаться] → [confirmed/waitlisted] → Готово
```

## 🔧 Ключевые команды разработки

| Команда | Назначение |
|---------|------------|
| `npm run dev` | Запуск в режиме разработки |
| `npm run build` | Сборка TypeScript |
| `npm run start` | Запуск production версии |
| `npm run prisma:migrate` | Применение миграций БД |
| `npm run prisma:studio` | GUI для работы с БД |
| `npm test` | Запуск тестов (последовательно, общая БД) |
| `npm run test:integration` | Интеграционные тесты |

## 📡 API Endpoints

### Health Check:
```bash
GET /health - состояние системы
```

### Bot Webhook (Telegram):
```bash
POST /webhook/{token} - прием сообщений от Telegram
```

## 🔍 Отладка и логирование

### Просмотр логов:
```bash
# Логи приложения — в консоли, где запущен npm run dev

# Логи базы данных
docker compose logs -f db

# Логи Redis
docker compose logs -f redis
```

### Включение DEBUG режима:
```bash
# В .env файле
LOG_LEVEL=debug
NODE_ENV=development
```

### Структура логов:
```
[INFO] 2025-11-24T06:15:22.985Z [BOT] registration.handleStart: User registration started | Context: {telegramId: 123456789}
```

## 📊 Мониторинг и метрики

### Проверка состояния системы:
```bash
curl "http://localhost:${API_PORT:-3001}/health"
```

### Ожидаемый ответ:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-24T06:15:22.985Z",
  "checks": {
    "database": "healthy",
    "redis": "healthy",
    "bot": "healthy"
  }
}
```

## 🐛 Частые проблемы и решения

### Проблема: "Database connection failed"
```bash
# Решение: Проверить что PostgreSQL запущен
docker-compose up -d db
```

### Проблема: "Bot token is required"
```bash
# Решение: Установить TELEGRAM_BOT_TOKEN в .env
echo "TELEGRAM_BOT_TOKEN=your_bot_token" >> .env
```

### Проблема: "Port already in use"
```bash
# Решение: освободить порт API (по умолчанию 3001) или сменить API_PORT в .env
lsof -ti:3001 | xargs kill -9
```

## 🎯 Следующие шаги

### Для изучения архитектуры:
- [🏗️ Архитектура системы](../architecture/overview.md)
- [📊 Модули и взаимодействие](../architecture/modules.md)

### Для изучения разработки:
- [👨‍💻 Developer Guide](developer-guide.md)
- [🔧 Стандарты кодирования](../development/coding-standards.md)

### Для понимания бизнес-логики:
- [📱 Пользовательские сценарии](../business/user-scenarios.md)
- [🎯 Видение продукта](../business/product-vision.md)

## 💡 Полезные ссылки

- **Полная техническая документация**: [Developer Guide](developer-guide.md)
- **Архитектурные решения**: [Architecture Overview](../architecture/overview.md)
- **Стандарты разработки**: [Coding Standards](../development/coding-standards.md)
- **Устранение проблем**: [Troubleshooting](../reference/troubleshooting.md)

---

**Готовы к разработке!** 🚀  
Если у вас есть вопросы, обратитесь к [Developer Guide](developer-guide.md) или создайте issue в репозитории.

---

**Последнее обновление:** 2026-05-11  
**Версия:** 1.1  
**Статус:** Готово к использованию