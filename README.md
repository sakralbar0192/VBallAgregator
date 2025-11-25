# 🏐 VBallAgregator

Telegram-бот для автоматизации организации волейбольных игр. Система помогает игрокам находить подходящие игры, а организаторам — управлять набором участников, отслеживать оплаты и координировать проведение игр.

## 🚀 Быстрый старт

### Установка и запуск
```bash
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

### Проверка работоспособности
```bash
# Проверка health endpoint
curl http://localhost:3001/health
```

## 📚 Документация

### 🎯 Быстрые ссылки

#### **Для новых разработчиков**
- [📖 Getting Started](documentation/guides/getting-started.md) - Быстрый старт за 5 минут
- [👨‍💻 Developer Guide](documentation/guides/developer-guide.md) - Полная техническая документация

#### **Для существующей команды**
- [🏗️ Архитектура](documentation/architecture/overview.md) - Обзор системной архитектуры
- [📊 Пользовательские сценарии](documentation/business/user-scenarios.md) - Все сценарии в одном месте
- [🔧 Стандарты разработки](documentation/development/coding-standards.md) - Правила и стандарты

#### **Для пользователей**
- [📱 Руководство пользователя](documentation/guides/user-guide.md) - Как использовать систему
- [❓ FAQ и устранение проблем](documentation/reference/faq.md) - Частые вопросы и решения

#### **Для DevOps**
- [🚀 Деплой и инфраструктура](documentation/guides/deployment-guide.md) - Развертывание системы
- [🔍 Устранение проблем](documentation/reference/troubleshooting.md) - Диагностика и решение проблем

---

### 📖 [Guides - Руководства](documentation/guides/)
Руководства для разных ролей и уровней экспертизы

- [Getting Started](documentation/guides/getting-started.md) - Быстрый старт для новичков
- [Developer Guide](documentation/guides/developer-guide.md) - Детальная техническая документация
- [User Guide](documentation/guides/user-guide.md) - Руководство пользователя
- [Deployment Guide](documentation/guides/deployment-guide.md) - Развертывание и DevOps

### 🏗️ [Architecture - Архитектура](documentation/architecture/)
Техническая архитектура системы

- [System Overview](documentation/architecture/overview.md) - Общий обзор архитектуры
- [Modules](documentation/architecture/modules.md) - Модули и их взаимодействие
- [Data Model](documentation/architecture/data-model.md) - Модель данных и БД
- [API Reference](documentation/architecture/api-reference.md) - Справочник API

### 🔧 [Development - Разработка](documentation/development/)
Процессы и стандарты разработки

- [Coding Standards](documentation/development/coding-standards.md) - Стандарты кодирования
- [Comprehensive Logging Guide](documentation/development/comprehensive-logging-guide.md) - Полное руководство по логированию
- [Testing Strategy](documentation/development/testing-strategy.md) - Стратегия тестирования
- [Workflow](documentation/development/workflow.md) - Процессы разработки
- [Release Process](documentation/development/release-process.md) - Процесс релизов

### 📊 [Business - Бизнес](documentation/business/)
Бизнес-логика и пользовательские сценарии

- [Product Vision](documentation/business/product-vision.md) - Видение продукта
- [User Scenarios](documentation/business/user-scenarios.md) - Пользовательские сценарии
- [Requirements](documentation/business/requirements.md) - Требования к системе

### ❓ [Reference - Справочник](documentation/reference/)
Справочная информация

- [Glossary](documentation/reference/glossary.md) - Глоссарий терминов
- [Troubleshooting](documentation/reference/troubleshooting.md) - Устранение проблем
- [FAQ](documentation/reference/faq.md) - Часто задаваемые вопросы

---

## 🔍 Поиск по документации

### Популярные темы:
- **Архитектура**: [Clean Architecture](documentation/architecture/overview.md), [Модули](documentation/architecture/modules.md)
- **Разработка**: [Стандарты кода](documentation/development/coding-standards.md), [Логирование](documentation/development/comprehensive-logging-guide.md)
- **Пользовательские сценарии**: [Регистрация](documentation/business/user-scenarios.md#регистрация), [Игры](documentation/business/user-scenarios.md#игры)
- **DevOps**: [Деплой](documentation/guides/deployment-guide.md), [Мониторинг](documentation/reference/troubleshooting.md)

### Часто задаваемые вопросы:
- [Как добавить новый модуль?](documentation/architecture/modules.md#добавление-нового-модуля)
- [Как создать пользовательский сценарий?](documentation/development/workflow.md#создание-сценариев)
- [Как настроить логирование?](documentation/development/comprehensive-logging-guide.md#настройка)
- [Как развернуть систему?](documentation/guides/deployment-guide.md#установка)

---

## 🛠️ Технологический стек

- **Backend**: Node.js + TypeScript + Telegraf (Telegram Bot API)
- **База данных**: PostgreSQL + Prisma ORM
- **Кэш и очереди**: Redis + BullMQ
- **API**: Fastify для REST endpoints
- **Контейнеризация**: Docker + docker-compose

## 📋 Статус документации

| Раздел | Полнота | Актуальность | Последнее обновление |
|--------|---------|--------------|---------------------|
| Guides | 100% | 95% | 2025-11-24 |
| Architecture | 100% | 90% | 2025-11-24 |
| Development | 100% | 85% | 2025-11-24 |
| Business | 100% | 90% | 2025-11-24 |
| Reference | 100% | 80% | 2025-11-24 |

**Легенда:**
- 🟢 Полная документация (90%+)
- 🟡 Частично документировано (70-89%)
- 🔴 Требует доработки (<70%)

---

## 🤝 Вклад в документацию

### Как помочь улучшить документацию:
1. **Найдена ошибка?** Создайте issue с описанием
2. **Есть предложения?** Откройте PR с улучшениями
3. **Нужна документация?** Добавьте недостающие разделы
4. **Устарела информация?** Обновите до актуального состояния

### Стандарты оформления:
- Используйте Markdown с заголовками H2-H4
- Добавляйте ссылки на связанные разделы
- Включайте примеры кода где применимо
- Обновляйте дату последнего изменения

---

## 📞 Поддержка

**Вопросы по документации:** 
- Создайте issue в репозитории
- Обратитесь к команде разработки

**Техническая поддержка:**
- [Устранение проблем](documentation/reference/troubleshooting.md)
- [Часто задаваемые вопросы](documentation/reference/faq.md)

---

**Последнее обновление:** 2025-11-24  
**Версия документации:** 1.0  
**Статус:** Актуальная ✅
