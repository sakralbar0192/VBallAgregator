## **🏗️ Архитектура системы**

### **Монолитная структура с модульной организацией**
Проект реализован как **модульный монолит** с четким разделением на слои DDD (Domain-Driven Design):

- **Domain Layer**: Бизнес-логика, доменные сущности, правила валидации
- **Application Layer**: Use cases, Application Services, Query Objects
- **Infrastructure Layer**: Репозитории, внешние API, event handlers
- **Shared Layer**: Утилиты, конфигурация, кросс-компонентная логика

### **Основные компоненты**

#### **Frontend (Telegram Bot)**
- Интерфейс взаимодействия с пользователями через Telegram API
- Обработка команд и предоставление информации
- Rate limiting для защиты от спама
- Валидация входных данных

#### **Backend (Node.js + TypeScript)**
- **Domain Layer**:
  - `Game` - агрегат для управления играми
  - `Registration` - сущность регистрации участников
  - Доменные сервисы для бизнес-правил

- **Application Layer**:
  - Use cases для основных операций
  - Application Services для координации
  - Query Objects для сложных запросов

- **Infrastructure Layer**:
  - Prisma ORM для работы с PostgreSQL
  - Event Bus для асинхронной обработки
  - Scheduler для отложенных задач
  - Notification Service для отправки сообщений

#### **Database & Infrastructure**
- **PostgreSQL**: Основная БД с индексами для производительности
- **Redis**: Кэширование и управление очередями (BullMQ)
- **Docker**: Контейнеризация для развертывания

### **Масштабируемость**
- **Текущая реализация**: Модульный монолит, подходящий для MVP
- **Будущая эволюция**: Возможен переход на микросервисы при росте нагрузки
- **Горизонтальное масштабирование**: Через репликацию БД и балансировку нагрузки
- **Вертикальное масштабирование**: Увеличение ресурсов сервера

### **Архитектурные паттерны**
- **DDD (Domain-Driven Design)**: Разделение на домены и bounded contexts
- **CQRS**: Разделение команд и запросов (частично реализовано)
- **Event-Driven Architecture**: Асинхронная обработка через Event Bus
- **Repository Pattern**: Абстракция доступа к данным
- **Application Services**: Координация между слоями

### **Диаграмма взаимодействия компонентов**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Telegram Bot  │────│ Application Layer│────│  Domain Layer   │
│                 │    │                  │    │                 │
│ • Command       │    │ • Use Cases      │    │ • Game Entity   │
│   Handlers      │    │ • Application    │    │ • Registration  │
│ • Validation    │    │   Services       │    │ • Domain        │
│ • Rate Limiting │    │ • Query Objects  │    │   Services      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│Infrastructure   │    │   Event Bus      │    │   Database      │
│Layer            │    │                  │    │   (PostgreSQL)  │
│                 │    │ • Event          │    │                 │
│ • Repositories  │    │   Publishing     │    │ • Users         │
│ • Event         │    │ • Async          │    │ • Games         │
│   Handlers      │    │   Processing     │    │ • Registrations │
│ • Notification  │    │                  │    │                 │
│   Service       │    └──────────────────┘    └─────────────────┘
│ • Scheduler     │              │
└─────────────────┘              │
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌──────────────────┐
│   Redis Queue   │    │   External APIs  │
│   (BullMQ)      │    │                  │
│                 │    │ • Telegram API   │
│ • Scheduled     │    │ • Date/Time      │
│   Tasks         │    │   Utils          │
└─────────────────┘    └──────────────────┘
```

### **Event Flow (поток событий)**

#### **Создание игры:**
1. **Bot** → **Application Layer** (`createGame` use case)
2. **Application Service** → **Domain Service** (валидация бизнес-правил)
3. **Repository** → **Database** (сохранение игры)
4. **Event Publisher** → **Event Bus** (`GameCreated` event)
5. **Event Handler** → **Scheduler** (планирование напоминаний)

#### **Регистрация на игру:**
1. **Bot** → **Application Layer** (`joinGame` use case)
2. **Application Service** → **Domain Service** (проверка capacity, дедлайнов)
3. **Repository** → **Database** (создание регистрации)
4. **Event Bus** → **Notification Service** (`PlayerJoined` event)
5. **Notification Service** → **Telegram API** (уведомление организатора)

#### **Напоминания:**
1. **Scheduler** (BullMQ) → **Event Bus** (`GameReminder24h` event)
2. **Event Handler** → **Repository** (получение участников)
3. **Notification Service** → **Telegram API** (массовые уведомления)
4. **Metrics** (обновление счетчиков отправленных уведомлений)

#### **Оплата:**
1. **Bot** → **Application Layer** (`markPayment` use case)
2. **Domain Service** (проверка окна оплаты)
3. **Repository** → **Database** (обновление статуса)
4. **Event Bus** → **Notification Service** (`PaymentMarked` event)
5. **Notification Service** → **Telegram API** (уведомление организатора)


