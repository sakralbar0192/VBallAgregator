# Техническая документация: Основные пользовательские сценарии VBallAgregator

> **Сводка продуктового scope:** что сейчас поддерживается для волейбола и ракеток — в [product-and-capabilities.md](product-and-capabilities.md).

> **Цель документа:** Разделить код на смысловые блоки для упрощения анализа и создания технической документации

## 📋 Оглавление

1. [Архитектурная карта модулей](#архитектурная-карта-модулей)
2. [Регистрационные сценарии](#регистрационные-сценарии)
3. [Сценарии игрока](#сценарии-игрока)
4. [Сценарии организатора](#сценарии-организатора)
5. [Платежные сценарии](#платежные-сценарии)
6. [Системные сценарии](#системные-сценарии)
7. [Техническая реализация по модулям](#техническая-реализация-по-модулям)

---

## 🏗️ Архитектурная карта модулей

### Bot Layer (Интерфейс пользователя)
```
src/bot/
├── bot.ts                    # Главная конфигурация бота
├── registration/             # Регистрационные сценарии
│   ├── registration-handler.ts
│   ├── level-selection-handler.ts
│   └── role-selection-handler.ts
├── game-management/          # Управление играми
│   └── game-management-handler.ts
├── payments/                 # Обработка платежей
│   ├── payment-handler.ts
│   └── payment-reminder-handler.ts
├── profile/                  # Профили пользователей
│   ├── profile-handler.ts
│   └── player-management-handler.ts
├── settings/                 # Настройки системы
│   ├── settings-handler.ts
│   └── organizer-selection-handler.ts
├── invitations/              # Система приглашений
│   └── invitation-handler.ts
└── common/                   # Общие компоненты
    ├── base-handler.ts
    ├── callback-parser.ts
    └── keyboard-builder.ts
```

### Application Layer (Бизнес-логика)
```
src/application/
├── use-cases.ts             # Основные бизнес-операции
├── services/
│   ├── user-service.ts      # Сервис пользователей
│   └── game-service.ts      # Сервис игр
└── queries/                 # Специализированные запросы
    ├── GetUserRegistrationsQuery.ts
    └── GamePaymentsDashboardQuery.ts
```

### Domain Layer (Доменные модели)
```
src/domain/
├── game.ts                  # Модель игры
├── registration.ts          # Модель регистрации
├── errors/                  # Система ошибок
└── services/                # Доменные сервисы
    └── game-domain-service.ts
```

### Infrastructure Layer (Инфраструктура)
```
src/infrastructure/
├── prisma.ts               # База данных
├── repositories/           # Репозитории данных
│   ├── user-repository.ts
│   ├── game-repository.ts
│   └── registration-repository.ts
└── health.ts              # Проверка состояния
```

---

## 📝 Регистрационные сценарии

### 🎯 Сценарий 1: Первичная регистрация пользователя

#### Пользовательский поток:
```
Пользователь → /start → Выбор роли → [Игрок → Выбор уровня → Выбор организаторов] → [Организатор → Профиль] → Готов
```

#### Команды и обработчики:
| Этап | Команда/Действие | Обработчик | Файл |
|------|------------------|------------|------|
| Инициализация | `/start` | `RegistrationHandler.handleStart` | [`src/bot/registration/registration-handler.ts:18`](src/bot/registration/registration-handler.ts:18) |
| Выбор роли | `role_player` | `LevelSelectionHandler.handleRolePlayer` | [`src/bot/registration/level-selection-handler.ts:18`](src/bot/registration/level-selection-handler.ts:18) |
| Выбор роли | `role_organizer` | `RegistrationHandler.handleRoleOrganizer` | [`src/bot/registration/registration-handler.ts:45`](src/bot/registration/registration-handler.ts:45) |
| Выбор уровня | `level_*` | `LevelSelectionHandler.handleLevelSelection` | [`src/bot/registration/level-selection-handler.ts:45`](src/bot/registration/level-selection-handler.ts:45) |
| Выбор организаторов | `select_organizers_registration` | `OrganizerSelectionHandler.handleSelectOrganizersRegistration` | [`src/bot/settings/organizer-selection-handler.ts:25`](src/bot/settings/organizer-selection-handler.ts:25) |
| Завершение | `finish_registration` | `LevelSelectionHandler.handleFinishRegistration` | [`src/bot/registration/level-selection-handler.ts:85`](src/bot/registration/level-selection-handler.ts:85) |

#### Бизнес-операции (Use Cases):
| Операция | Функция | Файл |
|----------|---------|------|
| Создание пользователя | `registerUser` | [`src/application/use-cases.ts:352`](src/application/use-cases.ts:352) |
| Обновление уровня | `updateUserLevel` | [`src/application/use-cases.ts:391`](src/application/use-cases.ts:391) |
| Регистрация организатора | `registerOrganizer` | [`src/application/use-cases.ts:419`](src/application/use-cases.ts:419) |
| Привязка к организаторам | `selectOrganizers` | [`src/application/use-cases.ts:450`](src/application/use-cases.ts:450) |

#### Сообщения пользователю:
```typescript
// Приветствие и выбор роли
'Привет! Я бот для организации волейбольных игр. Выбери свою роль:'
[Игрок] [Организатор]

// Выбор уровня для игрока
'Ты выбрал роль игрока. Теперь оцени свой уровень:'
[Новичок] [Любитель] [Опытный] [Профи]

// Завершение регистрации
'Отлично! Теперь ты можешь искать игры командой /games'
```

### 🎯 Сценарий 2: Повторная регистрация (идемпотентность)

#### Логика обработки:
- Проверка существования пользователя
- Обновление данных вместо создания дубликата
- Сохранение истории изменений

#### Код проверки:
```typescript
// src/application/use-cases.ts:361-369
const existingUser = await userRepo.findByTelegramId(telegramId);
if (existingUser) {
    // Обновляем существующего пользователя
    await userRepo.update(existingUser.id, { name, role });
    return existingUser;
}
```

---

## 🎾 Сценарии игрока

### 🎯 Сценарий 3: Поиск и просмотр игр

#### Пользовательский поток:
```
Пользователь → /games → Список игр → Выбор игры → Подробная информация
```

#### Команды и обработчики:
| Действие | Команда | Обработчик | Файл |
|----------|---------|------------|------|
| Список игр | `/games` | `GameManagementHandler.handleGames` | [`src/bot/game-management/game-management-handler.ts:17`](src/bot/game-management/game-management-handler.ts:17) |
| Информация об игре | `/game <id>` | `GameManagementHandler.handleGameInfo` | [`src/bot/game-management/game-management-handler.ts:25`](src/bot/game-management/game-management-handler.ts:25) |

#### Бизнес-операции:
- `listGames()` - получение списка игр для пользователя
- Фильтрация по уровню игрока
- Сортировка по дате проведения

#### Интерфейс отображения:
```typescript
// Формирование карточки игры
const gameCard = `
🎾 ${formatGameTimeForNotification(game.startsAt)}${level}
${getVenueName(game.venueId)}
${getGameStatusName(game.status)} (${availableSpots} мест свободно)
ID: \`${game.id}\`
`;
```

### 🎯 Сценарий 4: Запись на игру (join)

#### Пользовательский поток:
```
Игрок → [Кнопка "Записаться" / /join <id>] → Проверка условий → [confirmed/waitlisted]
```

#### Обработчики:
| Действие | Обработчик | Файл |
|----------|------------|------|
| Команда `/join` | `GameManagementHandler.handleJoin` | [`src/bot/game-management/game-management-handler.ts:37`](src/bot/game-management/game-management-handler.ts:37) |
| Callback `join_game_*` | `GameManagementHandler.handleGameAction` | [`src/bot/game-management/game-management-handler.ts:72`](src/bot/game-management/game-management-handler.ts:72) |

#### Бизнес-логика:
```typescript
// src/application/use-cases.ts:180-220
const result = await joinGame(gameId, userId);

// Проверки:
// 1. Игра существует и открыта
// 2. Игрок зарегистрирован в системе
// 3. Не записан на игру
// 4. Есть свободные места или создается лист ожидания
```

#### Состояния регистрации:
- `confirmed` - подтверждена запись
- `waitlisted` - в листе ожидания
- `canceled` - отменена

### 🎯 Сценарий 5: Отмена участия (leave)

#### Пользовательский поток:
```
Игрок → [Кнопка "Отменить" / /leave <id>] → Подтверждение → Статус canceled → Автопромоушен следующего
```

#### Обработчики:
| Действие | Обработчик | Файл |
|----------|------------|------|
| Команда `/leave` | `GameManagementHandler.handleLeave` | [`src/bot/game-management/game-management-handler.ts:57`](src/bot/game-management/game-management-handler.ts:57) |
| Callback `leave_game_*` | `GameManagementHandler.handleGameAction` | [`src/bot/game-management/game-management-handler.ts:72`](src/bot/game-management/game-management-handler.ts:72) |

#### Автопромоушен:
```typescript
// Автоматический перевод первого из waitlist в confirmed
if (nextInWaitlist) {
    await updateRegistration(nextInWaitlist.id, { status: 'confirmed' });
    await notifyPlayer(nextInWaitlist.userId, 'Место подтверждено!');
}
```

### 🎯 Сценарий 6: Просмотр личных игр

#### Команда: `/my`

#### Обработчик: `CommandHandlers.handleMy` ([`src/bot/command-handlers.ts:223`](src/bot/command-handlers.ts:223))

#### Функциональность:
- Отображение игр как участника
- Отображение созданных игр (для организаторов)
- Контекстные кнопки действий
- Статусы оплаты и участия

#### Запросы данных:
```typescript
// Регистрации как игрок
const playerQuery = new GetUserRegistrationsQuery(user.id);
const playerRegistrations = await playerQuery.execute();

// Игры как организатор (если применимо)
const organizerGames = await prisma.game.findMany({
    where: { organizerId: organizer.id },
    include: { registrations: { include: { user: true } } }
});
```

---

## 👑 Сценарии организатора

### 🎯 Сценарий 7: Создание игры

#### Пользовательский поток:
```
Организатор → /newgame → Мастер создания (Дата → Время → Уровень → Площадка → Вместимость → Цена) → Игра создана
```

#### Мастер создания: `GameCreationWizard` ([`src/bot/game-creation-wizard.ts`](src/bot/game-creation-wizard.ts))

#### Этапы создания:
1. **Выбор даты** - обработчик `handleDateSelection`
2. **Выбор времени** - обработчик `handleTimeSelection`  
3. **Выбор уровня** - обработчик `handleLevelSelection`
4. **Выбор площадки** - обработчик `handleVenueSelection`
5. **Вместимость** - обработчик `handleCapacitySelection`
6. **Цена** - обработчик `handlePriceSelection`

#### Callback обработчики:
```typescript
// src/bot/bot.ts:149-178
bot.action(/^wizard_date_(.+)$/, async (ctx) => {
    const dateKey = ctx.match[1];
    await GameCreationWizard.handleDateSelection(ctx, dateKey);
});
// ... аналогично для других этапов
```

#### Бизнес-операция:
- `createGame()` - создание игры с полным набором параметров

### 🎯 Сценарий 8: Управление записью на игры

#### Команды управления:
| Команда | Назначение | Обработчик |
|---------|------------|------------|
| `/close <id>` | Закрыть запись | `GameManagementHandler.handleClose` |
| `/payments <id>` | Статус оплат | `CommandHandlers.handlePayments` |

#### Функциональность:
- Закрытие/открытие записи на игру
- Просмотр списка записанных игроков
- Управление статусами регистраций
- Массовые операции

### 🎯 Сценарий 9: Управление игроками

#### Команды:
| Команда | Назначение | Файл |
|---------|------------|------|
| `/myplayers` | Подтвержденные игроки | [`src/bot/command-handlers.ts:558`](src/bot/command-handlers.ts:558) |
| `/pendingplayers` | Ожидающие подтверждения | [`src/bot/command-handlers.ts:589`](src/bot/command-handlers.ts:589) |

#### Операции подтверждения:
```typescript
// Подтверждение игрока
bot.action(/^confirm_player_(.+)$/, async (ctx) => {
    await PlayerManagementHandler.handleConfirmPlayer(ctx, ctx.match[0]);
});

// Отклонение игрока  
bot.action(/^reject_player_(.+)$/, async (ctx) => {
    await PlayerManagementHandler.handleRejectPlayer(ctx, ctx.match[0]);
});
```

#### Бизнес-операции:
- `confirmPlayer(organizerId, playerId)`
- `rejectPlayer(organizerId, playerId)`
- `getOrganizerPlayers(organizerId, status)`

---

## 💰 Платежные сценарии

### 🎯 Сценарий 10: Отметка оплаты игроком

#### Пользовательский поток:
```
Игра началась → Окно оплаты открыто → Игрок → [Кнопка "Оплатил" / /pay <id>] → Статус обновлен → Уведомление организатора
```

#### Временные ограничения:
- **До начала игры** - кнопка неактивна
- **После начала (`startsAt`)** - кнопка активируется
- **Ручная отметка** - игрок сам подтверждает оплату

#### Обработчики:
| Действие | Обработчик | Файл |
|----------|------------|------|
| Команда `/pay` | `GameManagementHandler.handlePay` | [`src/bot/game-management/game-management-handler.ts:42`](src/bot/game-management/game-management-handler.ts:42) |
| Callback `pay_game_*` | `GameManagementHandler.handleGameAction` | [`src/bot/game-management/game-management-handler.ts:90`](src/bot/game-management/game-management-handler.ts:90) |

#### Бизнес-логика:
```typescript
// src/application/use-cases.ts:280-320
if (now() < game.startsAt) {
    throw new BusinessRuleError('PAYMENT_WINDOW_NOT_OPEN');
}
await updateRegistration(userId, gameId, { 
    paymentStatus: 'paid', 
    paymentMarkedAt: now() 
});
```

#### Статусы оплаты:
- `unpaid` - не оплачено
- `paid` - оплачено

### 🎯 Сценарий 11: Мониторинг оплат организатором

#### Команда: `/payments <game_id>`

#### Обработчик: `CommandHandlers.handlePayments` ([`src/bot/command-handlers.ts:360`](src/bot/command-handlers.ts:360))

#### Специализированный запрос: `GamePaymentsDashboardQuery` ([`src/application/queries/GamePaymentsDashboardQuery.ts`](src/application/queries/GamePaymentsDashboardQuery.ts))

#### Отображение данных:
```typescript
const dashboard = await query.execute();
const payments = dashboard.players.map(player => 
    `${player.name}: ${getPaymentStatusName(player.paymentStatus)}`
).join('\n');
```

#### Функциональность:
- Статистика по оплатам
- Список неоплативших игроков
- Кнопка массового напоминания
- Исторические данные

### 🎯 Сценарий 12: Напоминания об оплате

#### Автоматические напоминания:
- При открытии окна оплаты (`startsAt`)
- За 2 часа до игры (если не оплачено)
- По запросу организатора

#### Обработчик массовых напоминаний: `PaymentReminderHandler` ([`src/bot/payments/payment-reminder-handler.ts`](src/bot/payments/payment-reminder-handler.ts))

#### Callback обработчик:
```typescript
bot.action(/^remind_payments_(.+)$/, async (ctx) => {
    await PaymentReminderHandler.handleRemindPaymentsCallback(ctx, ctx.match[0]);
});
```

---

## ⚙️ Системные сценарии

### 🎯 Сценарий 13: Система уведомлений

#### Типы уведомлений:
1. **Игровые напоминания:**
   - T-24 часа до игры
   - T-2 часа до игры
   - Начало игры (открытие окна оплаты)

2. **Платежные уведомления:**
   - Открытие окна оплаты
   - Напоминания о неоплате

3. **Системные уведомления:**
   - Подтверждение из листа ожидания
   - Изменения статуса игры
   - Сообщения от организатора

#### Настройки пользователя: `userPreferencesService` ([`src/shared/user-preferences-service.ts`](src/shared/user-preferences-service.ts))

#### Структура настроек:
```typescript
interface UserPreferences {
    globalNotifications: boolean;
    paymentRemindersAuto: boolean;
    paymentRemindersManual: boolean;
    gameReminders24h: boolean;
    gameReminders2h: boolean;
    organizerNotifications: boolean;
}
```

### 🎯 Сценарий 14: Планировщик задач

#### Система планирования: `scheduler-service.ts` ([`src/shared/scheduler-service.ts`](src/shared/scheduler-service.ts))

#### Типы задач:
1. **Напоминания об играх**
2. **Открытие окон оплаты**
3. **Автоматическое закрытие игр**
4. **Очистка устаревших данных**

#### Архитектура планировщика:
```typescript
interface ScheduledTask {
    id: string;
    type: 'reminder_24h' | 'reminder_2h' | 'payment_window' | 'cleanup';
    gameId: string;
    scheduledAt: Date;
    executed: boolean;
}
```

### 🎯 Сценарий 15: Система ошибок и валидации

#### Иерархия ошибок: `src/domain/errors/` ([`src/domain/errors/index.ts`](src/domain/errors/index.ts))

```typescript
abstract class DomainError extends Error {
    abstract code: string;
    abstract httpStatus: number;
}

class BusinessRuleError extends DomainError {
    code = 'BUSINESS_RULE_VIOLATION';
}

class ValidationError extends DomainError {
    code = 'VALIDATION_FAILED';
}
```

#### Валидация команд: `CommandValidator` ([`src/bot/common/command-validator.ts`](src/bot/common/command-validator.ts))

#### Правила валидации:
- Формат UUID для ID игр
- Проверка прав доступа
- Валидация временных интервалов
- Проверка бизнес-правил

---

## 🔧 Техническая реализация по модулям

### 📱 Bot Layer - Точка входа пользователей

#### Главный файл: `src/bot/bot.ts` ([`src/bot/bot.ts`](src/bot/bot.ts))

```typescript
// Архитектура регистрации обработчиков
bot.start(RegistrationHandler.handleStart);
bot.command('games', GameManagementHandler.handleGames);
bot.command('join', async (ctx) => {
    const gameId = await CommandValidator.validateAndExtractGameId(ctx, 'join');
    await GameManagementHandler.handleJoin(ctx, gameId);
});

// Callback обработчики с регулярными выражениями
bot.action(/^join_game_(.+)$/, async (ctx) => {
    await GameManagementHandler.handleGameAction(ctx, ctx.match[0] ?? '');
});
```

#### Rate Limiting: `telegraf-ratelimit`
```typescript
const limitConfig = { in: 2, out: 1, unique: true };
bot.use(rateLimit(limitConfig)); // 2 сообщения в секунду
```

### 🧠 Application Layer - Бизнес-логика

#### Основные Use Cases: `src/application/use-cases.ts` ([`src/application/use-cases.ts`](src/application/use-cases.ts))

| Функция | Назначение | Связанные сценарии |
|---------|------------|-------------------|
| `registerUser` | Регистрация нового пользователя | Сценарий 1, 2 |
| `joinGame` | Запись на игру | Сценарий 4 |
| `leaveGame` | Отмена записи | Сценарий 5 |
| `markPayment` | Отметка оплаты | Сценарий 10 |
| `createGame` | Создание игры | Сценарий 7 |
| `listGames` | Получение списка игр | Сценарий 3 |

#### Сервисы приложения:
- `UserApplicationService` - логика пользователей
- `GameApplicationService` - логика игр

#### Специализированные запросы:
- `GetUserRegistrationsQuery` - персональные регистрации
- `GamePaymentsDashboardQuery` - дашборд оплат

### 🏗️ Domain Layer - Модели данных

#### Ключевые модели:

##### Модель игры: `src/domain/game.ts`
```typescript
interface Game {
    id: string;
    organizerId: string;
    startsAt: Date;
    venueId: string;
    levelTag?: string;
    capacity: number;
    priceText?: string;
    status: 'open' | 'closed' | 'cancelled';
}
```

##### Модель регистрации: `src/domain/registration.ts`
```typescript
interface Registration {
    id: string;
    gameId: string;
    userId: string;
    status: 'confirmed' | 'waitlisted' | 'canceled';
    paymentStatus: 'unpaid' | 'paid';
    paymentMarkedAt?: Date;
}
```

#### Доменные сервисы:
- `GameDomainService` - доменные правила для игр

### 🗄️ Infrastructure Layer - Хранение данных

#### База данных: Prisma ORM

##### Схема данных:
```prisma
model User {
    id          String   @id @default(uuid())
    telegramId  Int      @unique
    name        String
    role        Role
    levelTag    String?
    createdAt   DateTime @default(now())
}

model Game {
    id          String   @id @default(uuid())
    organizerId String
    startsAt    DateTime
    venueId     String
    levelTag    String?
    capacity    Int
    priceText   String?
    status      GameStatus @default(OPEN)
    createdAt   DateTime @default(now())
}

model Registration {
    id              String @id @default(uuid())
    gameId          String
    userId          String
    status          RegistrationStatus
    paymentStatus   PaymentStatus @default(UNPAID)
    paymentMarkedAt DateTime?
    createdAt       DateTime @default(now())
}
```

#### Репозитории: `src/infrastructure/repositories/`

| Репозиторий | Назначение | Связанные операции |
|-------------|------------|-------------------|
| `UserRepository` | Пользователи | registerUser, updateUserLevel |
| `GameRepository` | Игры | createGame, listGames, findById |
| `RegistrationRepository` | Регистрации | joinGame, leaveGame, findByGame |

### 🔗 Shared Layer - Общие компоненты

#### Система логирования: `enhanced-logger.ts` ([`src/shared/enhanced-logger.ts`](src/shared/enhanced-logger.ts))

```typescript
// Структурированное логирование с correlation ID
logger.info('User registration started', {
    correlationId: generateCorrelationId(),
    userTelegramId: telegramId,
    action: 'REGISTER_USER'
});
```

#### Система уведомлений: `notification-service.ts` ([`src/shared/notification-service.ts`](src/shared/notification-service.ts))

```typescript
interface NotificationMessage {
    type: 'game_reminder' | 'payment_reminder' | 'system';
    recipient: string;
    message: string;
    actionUrl?: string;
}
```

#### Валидация данных: `input-validator.ts` ([`src/shared/input-validator.ts`](src/shared/input-validator.ts))

---

## 📊 Мониторинг и метрики

### Ключевые метрики сценариев

#### Регистрационные метрики:
- Время обработки команды `/start`
- Конверсия завершения регистрации
- Соотношение выбора роли игрока vs организатора

#### Игровые метрики:
- Количество записанных игроков на игру
- Время до заполнения игры
- Процент отмен регистраций

#### Платежные метрики:
- Время от начала игры до отметки оплаты
- Процент неоплативших игроков
- Эффективность напоминаний

### Система логирования

#### Уровни логирования:
- `DEBUG` - детальная отладочная информация
- `INFO` - ключевые операции пользователей
- `WARN` - потенциальные проблемы
- `ERROR` - критические ошибки

#### Структура лог-записей:
```json
{
    "timestamp": "2025-11-06T00:51:27.752Z",
    "level": "INFO",
    "correlationId": "REG_USER_12345_1730847087752",
    "action": "USER_REGISTRATION_COMPLETED",
    "userId": "user_uuid",
    "duration": 2500,
    "success": true
}
```

---

## 🚀 Заключение

Данная техническая документация предоставляет полную карту пользовательских сценариев VBallAgregator с привязкой к архитектуре кода. Документ разработан для:

- **Команды разработки** - понимание архитектуры и взаимосвязей
- **Технических писателей** - создание пользовательской документации
- **Системных аналитиков** - анализ требований и бизнес-процессов
- **DevOps инженеров** - мониторинг и отладка системы

### Основные принципы архитектуры:

1. **Разделение ответственности** - четкое разделение по слоям (Bot/Application/Domain/Infrastructure)
2. **Идемпотентность операций** - повторное выполнение не приводит к дублированию
3. **Обработка ошибок** - централизованная система ошибок с понятными сообщениями
4. **Модульность** - легкость тестирования и поддержки отдельных компонентов
5. **Масштабируемость** - возможность расширения функциональности без нарушения архитектуры

### Рекомендации по развитию:

- Добавить A/B тестирование для UX улучшений
- Реализовать систему метрик и аналитики
- Внедрить автоматизированное тестирование сценариев
- Создать мониторинг производительности ключевых операций
- Разработать систему резервного копирования данных

---

**Автор:** VBallAgregator Team  
**Версия документа:** 1.0  
**Дата создания:** 2025-11-06  
**Статус:** Готов к использованию  