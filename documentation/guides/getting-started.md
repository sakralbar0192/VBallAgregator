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
- Bun (рекомендуется) или npm
- Docker & docker-compose
- PostgreSQL (через Docker)
```

### 2. Установка и запуск
```bash
# Клонирование репозитория
git clone git@github.com:sakralbar0192/VBallAgregator.git
cd VBallAgregator

# Установка зависимостей
bun install

# Запуск инфраструктуры (PostgreSQL, Redis)
docker-compose up -d

# Настройка переменных окружения
cp .env.example .env
# Отредактируйте .env файл

# Настройка базы данных
bun run prisma:migrate
bun run prisma:generate

# Запуск приложения
bun run dev
```

### 3. Проверка работоспособности
```bash
# Проверка health endpoint
curl http://localhost:3001/health

# Проверка логов
tail -f logs/app.log
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
| `bun run dev` | Запуск в режиме разработки |
| `bun run build` | Сборка TypeScript |
| `bun run start` | Запуск production версии |
| `bun run prisma:migrate` | Применение миграций БД |
| `bun run prisma:studio` | GUI для работы с БД |
| `bun run test` | Запуск тестов |
| `bun run test:integration` | Интеграционные тесты |

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
# Логи приложения
tail -f logs/app.log

# Логи базы данных
docker-compose logs db

# Логи Redis
docker-compose logs redis
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
curl http://localhost:3001/health
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
# Решение: Остановить процессы на порту 3000
lsof -ti:3000 | xargs kill -9
```

## 🎯 Следующие шаги

### Для изучения архитектуры:
- [🏗️ Архитектура системы](../architecture/overview.md)
- [📊 Модули и взаимодействие](../architecture/modules.md)

### Для изучения разработки:
- [👨‍💻 Developer Guide](developer-guide.md)
- [🔧 Стандарты кодирования](development/coding-standards.md)

### Для понимания бизнес-логики:
- [📱 Пользовательские сценарии](../business/user-scenarios.md)
- [🎯 Видение продукта](../business/product-vision.md)

## 💡 Полезные ссылки

- **Полная техническая документация**: [Developer Guide](developer-guide.md)
- **Архитектурные решения**: [Architecture Overview](architecture/overview.md)
- **Стандарты разработки**: [Coding Standards](development/coding-standards.md)
- **Устранение проблем**: [Troubleshooting](../reference/troubleshooting.md)

---

**Готовы к разработке!** 🚀  
Если у вас есть вопросы, обратитесь к [Developer Guide](developer-guide.md) или создайте issue в репозитории.

---

**Последнее обновление:** 2025-11-24 07:52  
**Версия:** 1.0  
**Статус:** Готово к использованию ✅