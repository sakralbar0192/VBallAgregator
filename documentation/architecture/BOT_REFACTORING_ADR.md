# ADR-003: Рефакторинг модульной архитектуры Telegram-бота

**Статус:** Предложен  
**Дата:** 2025-11-05  
**Тип:** Архитектурный

## Контекст

Текущий файл `src/bot.ts` содержит 898 строк кода с более чем 40 обработчиками команд и callback'ов. Это создает следующие проблемы:

- Нарушение принципа единственной ответственности (SRP)
- Сложность в поддержке и тестировании
- Дублирование кода (например, поиск пользователя в каждом обработчике)
- Отсутствие четкой структуры и модульности
- Трудности для новых разработчиков при изучении кода

## Решение

Предлагается рефакторинг на основе модульной архитектуры с разделением на 7 основных доменных модулей:

### 1. Registration Module (`src/bot/registration/`)
**Ответственность:** Регистрация и аутентификация пользователей
```typescript
// Обработчики:
// - bot.start() - регистрация пользователя
// - role_player / role_organizer - выбор роли
// - level_* - выбор уровня мастерства
// - select_organizers_registration / finish_registration - финализация
```

### 2. Game Management Module (`src/bot/game-management/`)
**Ответственность:** Управление играми
```typescript
// Обработчики:
// - /games - список игр
// - /game <id> - информация об игре
// - join_game_*, leave_game_*, close_game_* - действия с играми
```

### 3. Payment Management Module (`src/bot/payments/`)
**Ответственность:** Система оплат и напоминаний
```typescript
// Обработчики:
// - /pay <id> - отметка оплаты
// - pay_game_* - callback оплаты
// - /payments <id> - статус оплат
// - remind_payments_* - отправка напоминаний
```

### 4. User Profile Module (`src/bot/profile/`)
**Ответственность:** Личный кабинет пользователя
```typescript
// Обработчики:
// - /my - мои игры
// - /myplayers - мои игроки (для организаторов)
// - /pendingplayers - ожидающие подтверждения
// - confirm_player_*, reject_player_* - управление игроками
```

### 5. Settings Module (`src/bot/settings/`)
**Ответственность:** Настройки пользователя
```typescript
// Обработчики:
// - /selectorganizers - выбор организаторов
// - settings_payments, settings_games, settings_organizer - разделы настроек
// - toggle_* - переключение настроек
```

### 6. Game Invitations Module (`src/bot/invitations/`)
**Ответственность:** Система приглашений
```typescript
// Обработчики:
// - /respondtogame - ответ на приглашение
// - respond_game_*_yes, respond_game_*_no - callback'ы ответов
```

### 7. Common Handlers Module (`src/bot/common/`)
**Ответственность:** Общие обработчики и утилиты
```typescript
// Обработчики:
// - /help - справка
// - bot.on('text') - неизвестные команды
// - bot.catch() - глобальный обработчик ошибок
```

## Переиспользуемые компоненты

### Base Handler (`src/bot/common/base-handler.ts`)
```typescript
export abstract class BaseHandler {
  protected static async getUser(ctx: Context): Promise<User | null>
  protected static async getOrganizer(userId: string): Promise<Organizer | null>
  protected static validateGameId(gameId: string): boolean
  protected static async requireUser(ctx: Context): Promise<User>
  protected static async requireOrganizer(ctx: Context): Promise<Organizer>
}
```

### Callback Data Parser (`src/bot/common/callback-parser.ts`)
```typescript
export class CallbackDataParser {
  static parseGameId(data: string): string | null
  static parsePlayerId(data: string): string | null
  static parseOrganizerId(data: string): string | null
}
```

### Keyboard Builder (`src/bot/common/keyboard-builder.ts`)
```typescript
export class KeyboardBuilder {
  static createGameActionKeyboard(gameId: string, options: GameActionOptions)
  static createSettingsKeyboard(preferences: UserPreferences)
  static createOrganizerSelectionKeyboard(organizers: Organizer[], selectedIds: Set<string>)
}
```

## Новая структура файлов

```
src/bot/
├── index.ts                     # Экспорт бота и основной инициализации
├── bot.ts                       # Основной файл (сокращенный до 100-150 строк)
├── registration/
│   ├── index.ts
│   ├── registration-handler.ts
│   ├── level-selection-handler.ts
│   └── role-selection-handler.ts
├── game-management/
│   ├── index.ts
│   ├── game-info-handler.ts
│   ├── game-list-handler.ts
│   └── game-actions-handler.ts
├── payments/
│   ├── index.ts
│   ├── payment-handler.ts
│   └── payment-reminder-handler.ts
├── profile/
│   ├── index.ts
│   ├── my-games-handler.ts
│   └── player-management-handler.ts
├── settings/
│   ├── index.ts
│   ├── settings-handler.ts
│   └── organizer-selection-handler.ts
├── invitations/
│   ├── index.ts
│   └── invitation-handler.ts
└── common/
    ├── index.ts
    ├── base-handler.ts
    ├── callback-parser.ts
    ├── keyboard-builder.ts
    └── validation.ts
```

## Причины принятия решения

### Преимущества
1. **Четкое разделение ответственности** - каждый модуль отвечает за конкретную область домена
2. **Улучшенная читаемость** - код легче понимать и поддерживать
3. **Повышенная тестируемость** - каждый модуль можно тестировать отдельно
4. **Устранение дублирования** - общие утилиты в `common/` модуле
5. **Масштабируемость** - легко добавлять новые функции в соответствующие модули
6. **Переиспользуемость** - компоненты можно использовать в разных местах
7. **Упрощенная навигация** - разработчики легко найдут нужный код

### Компромиссы
1. **Увеличение количества файлов** - с 1 большого файла до ~20 файлов
2. **Необходимость импортов** - между модулями
3. **Временные затраты на рефакторинг** - потребуется время на перенос кода

## Последствия

### Положительные
- Значительное улучшение качества кода
- Облегчение поддержки и развития
- Повышение скорости разработки новых функций
- Снижение количества ошибок из-за четкой структуры

### Негативные
- Краткосрочное увеличение времени на рефакторинг
- Необходимость обновления документации
- Возможные проблемы с миграцией данных сессий

## План реализации

### Этап 1: Создание базовых компонентов
1. Создать `BaseHandler` и базовые утилиты
2. Создать `CallbackDataParser` и `KeyboardBuilder`
3. Настроить экспорты в `common/index.ts`

### Этап 2: Создание модулей
1. Создать структуру папок для всех 7 модулей
2. Создать `index.ts` файлы для каждого модуля
3. Создать основные классы-обработчики

### Этап 3: Миграция кода
1. Перенести обработчики по модулям (в порядке зависимостей)
2. Обновить `src/bot/bot.ts` для использования новых модулей
3. Удалить старый код из `bot.ts`

### Этап 4: Тестирование
1. Провести интеграционное тестирование
2. Проверить все существующие функции
3. Обновить тесты при необходимости

### Этап 5: Документация
1. Обновить README и техническую документацию
2. Создать руководство для разработчиков
3. Обновить ADR-ы

## Заключение

Рефакторинг на модульную архитектуру значительно улучшит качество и поддерживаемость кода Telegram-бота. Несмотря на временные затраты, долгосрочные преимущества существенно перевешивают недостатки.

**Приоритет:** Высокий  
**Риск:** Низкий  
**Усилия:** Средние  
**Ожидаемый ROI:** Высокий