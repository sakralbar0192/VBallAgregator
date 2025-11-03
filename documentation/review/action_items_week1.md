# Action Items: Неделя 1 - Исправления и улучшения

**Приоритет**: Критический → Высокий → Средний  
**Статус**: Готово к реализации

---

## 🔴 КРИТИЧЕСКИЕ (Исправить до следующего коммита)

### 1. Синтаксическая ошибка в bot.ts

**Файл**: [`src/bot.ts`](src/bot.ts:201)  
**Строка**: 201-202  
**Проблема**: Отсутствует закрывающая скобка для `venue_` action handler

**Текущий код**:
```typescript
    await ctx.editMessageText(`Игра создана! ID: \`${game.id}\`\n\nРасскажи друзьям, чтобы они могли присоединиться командой /join ${game.id}`, { parse_mode: 'Markdown' });
  } catch (error: any) {
    await ctx.editMessageText(`Ошибка создания игры: ${error.message}`);
  }
bot.on('text', async (ctx) => {  // ← ОШИБКА: нет закрывающей скобки выше
```

**Исправление**:
```typescript
    await ctx.editMessageText(`Игра создана! ID: \`${game.id}\`\n\nРасскажи друзьям, чтобы они могли присоединиться командой /join ${game.id}`, { parse_mode: 'Markdown' });
  } catch (error: any) {
    await ctx.editMessageText(`Ошибка создания игры: ${error.message}`);
  }
});  // ← ДОБАВИТЬ ЗАКРЫВАЮЩУЮ СКОБКУ

bot.on('text', async (ctx) => {
```

**Проверка**: Запустить `bun run build` и убедиться что нет ошибок компиляции

---

### 2. Типизация в repositories.ts

**Файл**: [`src/infrastructure/repositories.ts`](src/infrastructure/repositories.ts)  
**Проблема**: Использование `as any` вместо правильной типизации

**Места с проблемой**:
- Строка 31: `game.status as any`
- Строка 51: `g.status as any`
- Строка 59: `status` (GameStatus)
- Строка 74, 85, 93, 103, 121: `reg.status as any`

**Исправление для PrismaGameRepo**:
```typescript
// ❌ БЫЛО
return new Game(
  game.id,
  game.organizerId,
  game.venueId,
  game.startsAt,
  game.capacity,
  game.levelTag || undefined,
  game.priceText || undefined,
  game.status as any  // ← НЕПРАВИЛЬНО
);

// ✅ СТАЛО
return new Game(
  game.id,
  game.organizerId,
  game.venueId,
  game.startsAt,
  game.capacity,
  game.levelTag || undefined,
  game.priceText || undefined,
  game.status as GameStatus  // ← ПРАВИЛЬНО
);
```

**Исправление для PrismaRegistrationRepo**:
```typescript
// ❌ БЫЛО
return new Registration(
  reg.id,
  reg.gameId,
  reg.userId,
  reg.status as any,  // ← НЕПРАВИЛЬНО
  reg.paymentStatus as any,  // ← НЕПРАВИЛЬНО
  reg.paymentMarkedAt || undefined,
  reg.createdAt
);

// ✅ СТАЛО
return new Registration(
  reg.id,
  reg.gameId,
  reg.userId,
  reg.status as RegStatus,  // ← ПРАВИЛЬНО
  reg.paymentStatus as PaymentStatus,  // ← ПРАВИЛЬНО
  reg.paymentMarkedAt || undefined,
  reg.createdAt
);
```

**Проверка**: Запустить `tsc --noEmit` в strict режиме

---

### 3. Обработка ошибок в bot.ts

**Файл**: [`src/bot.ts`](src/bot.ts)  
**Проблема**: Нет глобального обработчика ошибок для бота

**Добавить после строки 5**:
```typescript
// Глобальный обработчик ошибок
bot.catch((err, ctx) => {
  console.error('Bot error:', {
    error: err.message,
    stack: err.stack,
    userId: ctx.from?.id,
    command: ctx.message?.text
  });
  
  ctx.reply('Произошла ошибка. Попробуй позже или напиши /start для перезагрузки.')
    .catch(e => console.error('Failed to send error message:', e));
});
```

**Проверка**: Протестировать обработку ошибок в боте

---

## 🟡 ВЫСОКИЙ ПРИОРИТЕТ (Неделя 1-2)

### 4. Улучшить advisory lock

**Файл**: [`src/application/use-cases.ts`](src/application/use-cases.ts:23)  
**Проблема**: Неправильный алгоритм преобразования UUID в число для lock

**Текущий код**:
```typescript
// ❌ НЕПРАВИЛЬНО - может быть коллизия
const lockId = gameId.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;
```

**Решение 1 (Простое)**:
```typescript
// ✅ ПРАВИЛЬНО - использовать hashtext PostgreSQL
await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${gameId}))`;
```

**Решение 2 (С импортом)**:
```typescript
import { createHash } from 'crypto';

// ✅ ПРАВИЛЬНО - использовать MD5 хеш
const lockId = parseInt(
  createHash('md5').update(gameId).digest('hex').slice(0, 8),
  16
);
await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;
```

**Рекомендация**: Использовать Решение 1 (проще и надежнее)

**Тесты**: Добавить тест на race conditions
```typescript
it('should handle concurrent joins correctly', async () => {
  // Given: game with capacity 1
  // When: 2 users try to join simultaneously
  // Then: one should be confirmed, one waitlisted
  
  const promises = [
    joinGame(game.id, user1.id),
    joinGame(game.id, user2.id)
  ];
  
  const results = await Promise.all(promises);
  const statuses = results.map(r => r.status);
  
  expect(statuses).toContain(RegStatus.confirmed);
  expect(statuses).toContain(RegStatus.waitlisted);
});
```

---

### 5. Добавить валидацию входных данных

**Файл**: [`src/application/use-cases.ts`](src/application/use-cases.ts)  
**Проблема**: Нет проверки пустых или невалидных параметров

**Добавить в начало каждого use case**:

```typescript
// Для joinGame
export async function joinGame(gameId: string, userId: string) {
  // Валидация
  if (!gameId?.trim()) {
    throw new DomainError('INVALID_INPUT', 'gameId не может быть пустым');
  }
  if (!userId?.trim()) {
    throw new DomainError('INVALID_INPUT', 'userId не может быть пустым');
  }
  
  return prisma.$transaction(async (tx: any) => {
    // ... остальной код
  });
}

// Для createGame
export async function createGame(data: {
  organizerId: string;
  venueId: string;
  startsAt: Date;
  capacity: number;
  levelTag?: string;
  priceText?: string;
}) {
  // Валидация
  if (!data.organizerId?.trim()) {
    throw new DomainError('INVALID_INPUT', 'organizerId не может быть пустым');
  }
  if (!data.venueId?.trim()) {
    throw new DomainError('INVALID_INPUT', 'venueId не может быть пустым');
  }
  if (data.capacity <= 0) {
    throw new DomainError('INVALID_INPUT', 'capacity должна быть > 0');
  }
  if (data.startsAt <= new Date()) {
    throw new DomainError('INVALID_INPUT', 'startsAt должна быть в будущем');
  }
  
  // ... остальной код
}
```

**Добавить новый код ошибки в errors.ts**:
```typescript
export const ERROR_CODES = {
  // ... существующие коды
  INVALID_INPUT: 'INVALID_INPUT',
} as const;
```

---

### 6. Добавить логирование

**Создать файл**: `src/shared/logger.ts`

```typescript
export interface Logger {
  info(message: string, data?: any): void;
  error(message: string, data?: any): void;
  warn(message: string, data?: any): void;
  debug(message: string, data?: any): void;
}

class ConsoleLogger implements Logger {
  info(message: string, data?: any) {
    console.log(`[INFO] ${message}`, data ? JSON.stringify(data) : '');
  }

  error(message: string, data?: any) {
    console.error(`[ERROR] ${message}`, data ? JSON.stringify(data) : '');
  }

  warn(message: string, data?: any) {
    console.warn(`[WARN] ${message}`, data ? JSON.stringify(data) : '');
  }

  debug(message: string, data?: any) {
    if (process.env.DEBUG) {
      console.debug(`[DEBUG] ${message}`, data ? JSON.stringify(data) : '');
    }
  }
}

export const logger = new ConsoleLogger();
```

**Использовать в use-cases.ts**:
```typescript
import { logger } from '../shared/logger.js';

export async function joinGame(gameId: string, userId: string) {
  logger.info('joinGame started', { gameId, userId });
  
  try {
    // ... логика
    logger.info('joinGame completed', { gameId, userId, status });
    return { status };
  } catch (error) {
    logger.error('joinGame failed', { gameId, userId, error: error.message });
    throw error;
  }
}
```

---

## 🟢 СРЕДНИЙ ПРИОРИТЕТ (Неделя 2-3)

### 7. Вынести hardcoded значения в конфиг

**Создать файл**: `src/config/venues.ts`

```typescript
export interface Venue {
  id: string;
  name: string;
  city?: string;
}

export const VENUES: Venue[] = [
  { id: 'venue-volna-id', name: 'Стадион "Волна"', city: 'Иркутск' },
  { id: 'venue-olimp-id', name: 'СК "Олимп"', city: 'Иркутск' },
  { id: 'venue-south-id', name: 'Парк "Южный"', city: 'Иркутск' }
];

export const DEFAULT_GAME_CONFIG = {
  capacity: 12,
  levelTag: 'amateur',
  priceText: '500₽'
};
```

**Использовать в bot.ts**:
```typescript
import { VENUES, DEFAULT_GAME_CONFIG } from '../config/venues.js';

bot.command('newgame', async (ctx: any) => {
  // ...
  await ctx.reply('Выбери площадку для игры:', {
    reply_markup: {
      inline_keyboard: VENUES.map(venue => [
        { text: venue.name, callback_data: `venue_${venue.id}` }
      ])
    }
  });
});

bot.action(/^venue_(.+)$/, async (ctx: any) => {
  const venueId = ctx.match[1];
  const venue = VENUES.find(v => v.id === venueId);
  
  if (!venue) return ctx.editMessageText('Площадка не найдена');
  
  const startsAt = new Date();
  startsAt.setHours(startsAt.getHours() + 2);
  
  const game = await createGame({
    organizerId: user.id!,
    venueId: venue.id,
    startsAt,
    ...DEFAULT_GAME_CONFIG
  });
  // ...
});
```

---

### 8. Улучшить обработку null/undefined

**Файл**: [`src/bot.ts`](src/bot.ts:42-47)  
**Проблема**: Избыточная проверка `!user.id` когда user не null

**Текущий код**:
```typescript
// ❌ НЕПРАВИЛЬНО
const user = await prisma.user.findUnique({ where: { telegramId } });
if (!user || !user.id) {  // user.id всегда существует если user не null
  return ctx.editMessageText('Пользователь не найден');
}
```

**Исправление**:
```typescript
// ✅ ПРАВИЛЬНО
const user = await prisma.user.findUnique({ where: { telegramId } });
if (!user) {
  return ctx.editMessageText('Пользователь не найден');
}
```

**Применить везде в bot.ts** где есть такая проверка.

---

### 9. Добавить тесты на edge cases

**Файл**: [`src/tests/use-cases.test.ts`](src/tests/use-cases.test.ts)  
**Добавить тесты**:

```typescript
describe('Edge cases', () => {
  it('should reject joinGame with empty gameId', async () => {
    const user = await prisma.user.create({
      data: { telegramId: 123456789, name: 'Test User' }
    });
    
    expect(async () => {
      await joinGame('', user.id);
    }).toThrow('gameId не может быть пустым');
  });

  it('should reject joinGame with empty userId', async () => {
    expect(async () => {
      await joinGame('some-game-id', '');
    }).toThrow('userId не может быть пустым');
  });

  it('should reject createGame with capacity <= 0', async () => {
    const user = await prisma.user.create({
      data: { telegramId: 123456789, name: 'Test User' }
    });
    const organizer = await prisma.organizer.create({
      data: { userId: user.id, title: 'Test Organizer' }
    });

    expect(async () => {
      await createGame({
        organizerId: organizer.id,
        venueId: 'venue1',
        startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        capacity: 0
      });
    }).toThrow('capacity должна быть > 0');
  });

  it('should reject createGame with past startsAt', async () => {
    const user = await prisma.user.create({
      data: { telegramId: 123456789, name: 'Test User' }
    });
    const organizer = await prisma.organizer.create({
      data: { userId: user.id, title: 'Test Organizer' }
    });

    expect(async () => {
      await createGame({
        organizerId: organizer.id,
        venueId: 'venue1',
        startsAt: new Date(Date.now() - 60 * 60 * 1000),
        capacity: 10
      });
    }).toThrow('startsAt должна быть в будущем');
  });
});
```

---

### 10. Добавить README с инструкциями

**Создать/обновить**: `README.md`

```markdown
# VBall Agregator - Telegram Bot для организации волейбольных игр

## Быстрый старт

### Требования
- Docker и Docker Compose
- Node.js 20+ (для локальной разработки)
- Bun (для локальной разработки)

### Запуск через Docker

\`\`\`bash
# Скопировать .env.example в .env и заполнить TELEGRAM_BOT_TOKEN
cp .env.example .env

# Запустить контейнеры
docker-compose up -d

# Проверить логи
docker-compose logs -f app
\`\`\`

### Локальная разработка

\`\`\`bash
# Установить зависимости
bun install

# Запустить миграции
bun run prisma:migrate

# Запустить бота
bun run dev
\`\`\`

### Тестирование

\`\`\`bash
# Запустить тесты
bun test

# Запустить с покрытием
bun test --coverage
\`\`\`

## Архитектура

- **Domain**: Бизнес-логика (Game, Registration)
- **Application**: Use cases (joinGame, leaveGame, markPayment)
- **Infrastructure**: Prisma, repositories
- **Shared**: Event publisher, logger, types

## Команды бота

- `/start` - Регистрация и выбор роли
- `/games` - Список активных игр
- `/join <id>` - Записаться на игру
- `/leave <id>` - Отменить запись
- `/pay <id>` - Отметить оплату
- `/newgame` - Создать новую игру
- `/my` - Мои игры

## Переменные окружения

\`\`\`
DATABASE_URL=postgresql://user:password@localhost:5432/vball_db
TELEGRAM_BOT_TOKEN=your_bot_token_here
DEBUG=false
\`\`\`
```

---

## 📋 Чек-лист для реализации

### Критические (Обязательно)
- [ ] Исправить синтаксическую ошибку в bot.ts (строка 201)
- [ ] Исправить типизацию в repositories.ts (заменить as any)
- [ ] Добавить обработчик ошибок в bot.ts
- [ ] Запустить `bun run build` без ошибок
- [ ] Запустить `bun test` - все тесты проходят

### Высокий приоритет
- [ ] Улучшить advisory lock алгоритм
- [ ] Добавить валидацию входных данных
- [ ] Добавить логирование
- [ ] Добавить тест на race conditions

### Средний приоритет
- [ ] Вынести hardcoded значения в конфиг
- [ ] Улучшить обработку null/undefined
- [ ] Добавить edge case тесты
- [ ] Обновить README

---

## 🎯 Ожидаемые результаты

После реализации всех action items:
- ✅ Код компилируется без ошибок
- ✅ Все тесты проходят
- ✅ Нет TypeScript ошибок в strict режиме
- ✅ Логирование работает
- ✅ Обработка ошибок полная
- ✅ Валидация входных данных
- ✅ Готово к переходу на Неделю 2

---

**Версия**: 1.0  
**Дата**: 2025-11-03  
**Статус**: Готово к реализации
