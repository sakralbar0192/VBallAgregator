# Пошаговый план реализации волейбольного агрегатора

На основе документации создаю детальный план разработки MVP с учетом архитектурных решений и пользовательских сценариев.

## 🎯 Общая стратегия

**Подход**: Итеративная разработка с фокусом на критический путь  
**Длительность**: 12-13 недель (8 часов/неделя)  
**Архитектура**: Modular monolith с четкими границами контекстов  

## 📋 Фаза 1: Фундамент (Недели 1-3)

### Неделя 1: Инфраструктура и базовая настройка
```typescript
// Приоритетные задачи
✅ Настройка проекта (Node.js + TypeScript + Prisma)
✅ Docker-контейнеризация
✅ Базовая схема PostgreSQL
✅ Telegram Bot (команда /start)
✅ CI/CD pipeline
```

**Критерии готовности**:
- Локальный стенд работает
- Бот отвечает на `/start`
- База данных развернута

### Неделя 2: Доменная модель Users
```sql
-- Схема БД
CREATE TABLE users (
  id UUID PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  level_tag VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE organizers (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  title VARCHAR(255),
  description TEXT
);
```

**Функционал**:
- Регистрация через `/start`
- Выбор роли (игрок/организатор)
- Самооценка уровня игрока

### Неделя 3: Система привязок
```typescript
// Use case: привязка игрока к организатору
export async function linkPlayerToOrganizer(
  playerId: string, 
  organizerId: string
) {
  // Логика создания связи
  // Уведомление организатору
}
```

**Результат**: Полная регистрация пользователей с ролями

## 📋 Фаза 2: Ядро системы игр (Недели 4-7)

### Неделя 4: Создание игр
```typescript
// Domain model
class Game {
  constructor(
    readonly id: string,
    readonly organizerId: string,
    public startsAt: Date,
    public capacity: number,
    public levelTag?: string,
    public status: GameStatus = GameStatus.open
  ) {}
  
  ensureCanJoin(confirmedCount: number) {
    if (this.status !== GameStatus.open) 
      throw new DomainError('GAME_NOT_OPEN');
    if (confirmedCount >= this.capacity) 
      throw new DomainError('CAPACITY_REACHED');
  }
}
```

**Команды организатора**: `/newgame` с полным мастером создания

### Неделя 5: Система записи на игры
```typescript
// Критический use case
export async function joinGame(gameId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    await advisoryLock(tx, `game:${gameId}`);
    
    const game = await tx.game.findUnique({ where: { id: gameId } });
    const confirmedCount = await tx.registration.count({ 
      where: { gameId, status: 'confirmed' } 
    });
    
    const status = confirmedCount < game.capacity ? 'confirmed' : 'waitlisted';
    
    await tx.registration.upsert({
      where: { gameId_userId: { gameId, userId } },
      create: { gameId, userId, status },
      update: { status }
    });
    
    await publish(evt('PlayerJoined', { gameId, userId, status }));
  });
}
```

### Неделя 6: Лист ожидания и отмены
```typescript
// Policy: автопромоушен из waitlist
export async function onRegistrationCanceled(gameId: string) {
  const next = await prisma.registration.findFirst({
    where: { gameId, status: 'waitlisted' },
    orderBy: { createdAt: 'asc' }
  });
  
  if (next) {
    await promoteToConfirmed(next.id);
    await publish(evt('WaitlistedPromoted', { gameId, userId: next.userId }));
  }
}
```

### Неделя 7: Базовые уведомления
```typescript
// Планирование напоминаний
export async function scheduleGameReminders(game: Game) {
  await scheduleJob('reminder-24h', game.startsAt, { gameId: game.id, type: '24h' });
  await scheduleJob('reminder-2h', game.startsAt, { gameId: game.id, type: '2h' });
}
```

**Результат**: Полный цикл создания и записи на игру

## 📋 Фаза 3: Система оплат (Недели 8-10)

### Неделя 8: Окно оплаты после старта
```typescript
// Бизнес-правило: оплата только после startsAt
export async function markPayment(gameId: string, userId: string) {
  const game = await findGame(gameId);
  
  if (new Date() < game.startsAt) {
    await publish(evt('PaymentAttemptRejectedEarly', { gameId, userId }));
    throw new DomainError('PAYMENT_WINDOW_NOT_OPEN');
  }
  
  await updatePaymentStatus(gameId, userId, 'paid');
  await publish(evt('PaymentMarked', { gameId, userId }));
}
```

### Неделя 9: Дашборд организатора
```typescript
// Read model для организатора
interface GamePaymentsDashboard {
  gameId: string;
  players: Array<{
    userId: string;
    name: string;
    paymentStatus: 'paid' | 'unpaid';
    paymentMarkedAt?: Date;
  }>;
  paidCount: number;
  unpaidCount: number;
}
```

**Команды**: `/payments <gameId>`, массовые напоминания

### Неделя 10: Напоминания об оплате
```typescript
// Policy: напоминания после игры
export async function schedulePaymentReminders(gameId: string) {
  const game = await findGame(gameId);
  
  // Через 12 часов после игры
  await scheduleJob('payment-reminder-12h', 
    addHours(game.startsAt, 12), 
    { gameId, type: 'payment-12h' }
  );
  
  // Через 24 часа после игры  
  await scheduleJob('payment-reminder-24h',
    addHours(game.startsAt, 24),
    { gameId, type: 'payment-24h' }
  );
}
```

## 📋 Фаза 4: Финализация MVP (Недели 11-13)

### Неделя 11: Полировка UX
- Тексты уведомлений
- Обработка edge cases
- Валидация пользовательского ввода

### Неделя 12: Тестирование
```typescript
// Критические тест-кейсы
describe('Game Registration', () => {
  it('should waitlist when capacity reached', async () => {
    // Given: игра с capacity=1, уже есть 1 confirmed
    // When: второй игрок пытается записаться  
    // Then: статус = waitlisted
  });
  
  it('should promote from waitlist on cancellation', async () => {
    // Given: есть waitlisted игрок
    // When: confirmed игрок отменяет запись
    // Then: waitlisted становится confirmed + уведомление
  });
  
  it('should reject early payment attempts', async () => {
    // Given: игра еще не началась
    // When: попытка отметить оплату
    // Then: PaymentAttemptRejectedEarly + ошибка
  });
});
```

### Неделя 13: Подготовка к запуску
- Мониторинг (Sentry)
- Логирование
- Документация для тестовой группы
- Деплой на продакшн

## 🎯 Критерии готовности MVP

### Технические метрики
- ✅ Время отклика бота < 2 сек
- ✅ Доставка уведомлений > 95%
- ✅ Покрытие тестами критических сценариев > 80%

### Функциональные критерии
- ✅ Полный цикл: регистрация → создание игры → запись → напоминания → оплата
- ✅ Система приоритетов работает (свои игроки → целевой уровень → все)
- ✅ Лист ожидания с FIFO промоушеном
- ✅ Окно оплаты открывается строго после startsAt
- ✅ Организатор видит статусы оплат и может отправлять напоминания

## 🚀 План запуска

### Подготовка (1 неделя)
- Подключение 1 организатора
- Инструктаж 15-20 игроков
- Создание тестового чата

### Пилот (3 недели)
```
Неделя 1: Регистрация + первая игра
Неделя 2: Тестирование всех сценариев  
Неделя 3: Сбор фидбека + итерации
```

## 🔧 Технические детали

### Стек
```
Backend: Node.js + TypeScript + Fastify
Database: PostgreSQL + Prisma ORM
Queue: BullMQ + Redis
Bot: Telegraf
Monitoring: Sentry + Winston
Deploy: Docker + VPS
```

### Архитектурные принципы
- Event-driven architecture
- Domain-driven design (тактический уровень)
- CQRS для read models
- Transactional boundaries через агрегаты

## 📊 Риски и митигация

| Риск | Вероятность | Митигация |
|------|-------------|-----------|
| Гонки в записи на игру | Высокая | Advisory locks + Serializable isolation |
| Недоставка уведомлений | Средняя | Retry механизм + мониторинг |
| Сложность тестирования | Средняя | Тестовая группа с реальными играми |
| Сопротивление пользователей | Низкая | Постепенное внедрение + обучение |

## 🎪 Следующие шаги

1. **Неделя 1**: Настроить инфраструктуру и базовый бот
2. **Найти тестового организатора** для валидации требований
3. **Еженедельные демо** для сбора обратной связи
4. **Документировать решения** для будущих итераций

Этот план обеспечивает пошаговое создание работающего MVP с фокусом на критические пользовательские сценарии и техническую надежность.