## **🏗️ Архитектура системы**

### **Монолитная структура с модульной организацией**
Проект реализован как **модульный монолит** с четким разделением на слои DDD (Domain-Driven Design):

- **Domain Layer**: Бизнес-логика, доменные сущности (Game, Registration), правила валидации, доменные сервисы
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
- **Domain Layer** ([`src/domain/`](../../src/domain/)):
  - **Aggregate Roots**:
    - `Game` - управление жизненным циклом игры (статусы: open, closed, finished, canceled)
    - `Registration` - управление регистрацией участников (статусы: confirmed, waitlist, canceled)
  - **Value Objects**: Статусы, ошибки, перечисления
  - **Domain Services**:
    - `GameDomainService` - бизнес-правила для игр
    - Валидация бизнес-правил (capacity, payment window, game status)
  - **Error System**:
    - `BusinessRuleError` - нарушение бизнес-правил
    - `ValidationError` - ошибки валидации
    - `SystemError` - системные ошибки

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
- **DDD (Domain-Driven Design)**: Разделение на домены и bounded contexts ✅
- **Query Objects**: Реализованы для чтения данных ✅
- **Repository Pattern**: Полная реализация с базовым классом и интерфейсами ✅
- **Event-Driven Architecture**: Асинхронная обработка через Event Bus ✅
- **Application Services**: Координация между слоями ✅
- **⚠️ Command Pattern**: Команды не реализованы (только bot command handlers)

### **Диаграмма взаимодействия компонентов**

```mermaid
graph TB
    %% Presentation Layer
    subgraph "Presentation Layer"
        Bot[Telegram Bot<br/>• Command Handlers<br/>• Validation<br/>• Rate Limiting]
        API[HTTP API<br/>• REST Endpoints<br/>• Health Checks]
    end
    
    %% Application Layer
    subgraph "Application Layer"
        UseCases[Use Cases<br/>• createGame<br/>• joinGame<br/>• markPayment]
        AppServices[Application Services<br/>• GameApplicationService<br/>• UserApplicationService<br/>• InvitationService<br/>• OrganizerService]
        QueryObjects[Query Objects<br/>• GamePaymentsDashboardQuery<br/>• GetUserRegistrationsQuery]
        Factory[ApplicationServiceFactory<br/>• Dependency Management<br/>• Service Creation]
    end
    
    %% Domain Layer
    subgraph "Domain Layer"
        Entities[Domain Entities<br/>• Game<br/>• Registration<br/>• User]
        DomainServices[Domain Services<br/>• GameDomainService<br/>• Business Rules]
        Errors[Error System<br/>• BusinessRuleError<br/>• ValidationError]
    end
    
    %% Infrastructure Layer
    subgraph "Infrastructure Layer"
        Repos[Repositories<br/>• GameRepo<br/>• UserRepo<br/>• RegistrationRepo<br/>• OrganizerRepo]
        EventBus[Event Bus<br/>• Event Publishing<br/>• Async Processing]
        Scheduler[Scheduler Service<br/>• BullMQ Queues<br/>• Task Scheduling]
        Notification[Notification Service<br/>• Telegram API<br/>• Email Notifications]
        External[External APIs<br/>• Telegram Bot API<br/>• Date/Time Utils]
    end
    
    %% Data Layer
    subgraph "Data Layer"
        Database[(PostgreSQL<br/>• Users<br/>• Games<br/>• Registrations<br/>• Organizers)]
        Redis[(Redis<br/>• Queue Storage<br/>• Session Cache<br/>• Rate Limiting)]
    end
    
    %% Connections
    Bot --> UseCases
    API --> UseCases
    UseCases --> AppServices
    AppServices --> Factory
    Factory --> Repos
    AppServices --> DomainServices
    DomainServices --> Entities
    
    AppServices --> EventBus
    EventBus --> Notification
    EventBus --> Scheduler
    Scheduler --> Redis
    Scheduler --> EventBus
    
    Repos --> Database
    Notification --> External
    
    EventBus --> Repos
    Repos --> Database
    
    classDef presentation fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef application fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef domain fill:#e8f5e8,stroke:#388e3c,stroke-width:2px
    classDef infrastructure fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef data fill:#fce4ec,stroke:#c2185b,stroke-width:2px
    
    class Bot,API presentation
    class UseCases,AppServices,QueryObjects,Factory application
    class Entities,DomainServices,Errors domain
    class Repos,EventBus,Scheduler,Notification,External infrastructure
    class Database,Redis data
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


