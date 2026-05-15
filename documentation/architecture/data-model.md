# Domain Model Design — Volleyball MVP (Node/TS)

Ниже — тактический DDD-дизайн под **Node.js + TypeScript + Prisma + Postgres** для MVP «только бот + сервер + БД». Опирается на Event Storming из канваса.

---

## Мульти-спорт: пользователь, профили, подбор (Prisma)

Каноническая схема: [`packages/core/prisma/schema.prisma`](../../packages/core/prisma/schema.prisma).

- **`User`**: идентичность Telegram, **`gender`**, **`ageBand`** (диапазоны, один раз при онбординге), **`levelTag`** для волейбольного игрового потока, **`activeSport`** (`SportKind`: `volleyball` | `tennis`).
- **`UserSportProfile`**: одна строка на пару **`(userId, sport)`** — атрибуты онбординга по виду (форматы волейбола, флаг «планирую организовать волейбольные игры», навык тенниса и т.д.).
- **`MatchingProfile`** / **`MatchingSchedule`**: составной первичный ключ **`(userId, sport)`** — отдельные предпочтения подбора и расписание для каждого вида спорта.

Границы bounded context (см. [ADR 0001](adr/0001-bounded-contexts-and-services.md)): демография и идентичность — контур **user**; предпочтения подбора и расписание — контур **matching** (после split — отдельная БД/outbox).

---

## 1) Ubiquitous Language (глоссарий)

* **Game** — мероприятие с `startsAt`, `venue`, `capacity`, `levelTag`, `priceText`, `status`.
* **Registration** — участие пользователя в игре со статусами `confirmed | waitlisted | canceled` и `paymentStatus`.
* **Organizer** — пользователь, владеющий играми.
* **Waitlist** — очередь FIFO игроков, не попавших в лимит.
* **Payment Window** — период `now >= startsAt`, когда можно отмечать оплату.

---

## 2) Границы агрегатов (Aggregate boundaries)

### Вариант (выбран для MVP): **Game = Aggregate Root**, `Registration` — сущность внутри Game

* **Почему**: инвариант вместимости (`capacity > confirmedCount`) и промоушен waitlist проще и надёжнее обеспечивать «под зонтиком» одного AR.
* **Транзакции**: все изменения регистраций выполняются в транзакции с «захватом» Game (см. 7.2 про advisory lock).
* **Компромисс**: при росте можно выделить `Registrations` в отдельный AR и использовать outbox/event‑based координацию.

Альтернатива: `Registration` как отдельный AR — подходит при высоком потоке и распределённых сервисах (нужен саги-подход), **не нужен для MVP**.

---

## 3) Инварианты и состояния

### 3.1 Game

```ts
export enum GameStatus { open = 'open', closed = 'closed', finished = 'finished', canceled = 'canceled' }

export class Game {
  constructor(
    readonly id: string,
    readonly organizerId: string,
    readonly venueId: string,
    public startsAt: Date,
    public capacity: number,
    public levelTag?: string,
    public priceText?: string,
    public status: GameStatus = GameStatus.open,
  ) {}

  get isPaymentWindowOpen(): boolean { return new Date() >= this.startsAt && (this.status === GameStatus.open || this.status === GameStatus.finished); }

  ensureCanJoin(confirmedCount: number) {
    if (this.status !== GameStatus.open) throw new DomainError('GAME_NOT_OPEN');
    if (this.startsAt <= new Date()) throw new DomainError('GAME_ALREADY_STARTED');
    if (confirmedCount >= this.capacity) throw new DomainError('CAPACITY_REACHED');
  }

  close() { this.status = GameStatus.closed; }
  finish() { this.status = GameStatus.finished; }
  cancel() { this.status = GameStatus.canceled; }
}
```

### 3.2 Registration

```ts
export enum RegStatus { confirmed='confirmed', waitlisted='waitlisted', canceled='canceled' }
export enum PaymentStatus { unpaid='unpaid', paid='paid' }

export class Registration {
  constructor(
    readonly id: string,
    readonly gameId: string,
    readonly userId: string,
    public status: RegStatus,
    public paymentStatus: PaymentStatus = PaymentStatus.unpaid,
    public paymentMarkedAt?: Date,
    readonly createdAt: Date = new Date(),
  ) {}

  markPaid(game: Game) {
    if (!game.isPaymentWindowOpen) throw new DomainError('PAYMENT_WINDOW_NOT_OPEN');
    if (this.status !== RegStatus.confirmed) throw new DomainError('NOT_CONFIRMED');
    this.paymentStatus = PaymentStatus.paid;
    this.paymentMarkedAt = new Date();
  }

  cancel() { this.status = RegStatus.canceled; }
}
```

---

## 4) Domain Events (интерфейсы)

```ts
export type DomainEvent = { type: string; occurredAt: Date; payload: any; id: string };

export interface GameCreated extends DomainEvent { type: 'GameCreated'; payload: { gameId: string; startsAt: string; capacity: number; levelTag?: string; priceText?: string; }; }
export interface PlayerJoined extends DomainEvent { type: 'PlayerJoined'; payload: { gameId: string; userId: string; status: 'confirmed'|'waitlisted' }; }
export interface RegistrationCanceled extends DomainEvent { type: 'RegistrationCanceled'; payload: { gameId: string; userId: string }; }
export interface WaitlistedPromoted extends DomainEvent { type: 'WaitlistedPromoted'; payload: { gameId: string; userId: string }; }
export interface GameStarted extends DomainEvent { type: 'GameStarted'; payload: { gameId: string }; }
export interface PaymentMarked extends DomainEvent { type: 'PaymentMarked'; payload: { gameId: string; userId: string }; }
```

> События сохраняем в outbox (таблица) **опционально**. Для MVP достаточно in‑process публикации с идемпотентными обработчиками.

---

## 5) Репозитории (контракты)

```ts
export interface GameRepo {
  findById(id: string): Promise<Game | null>;
  countConfirmed(gameId: string): Promise<number>;
  insertGame(g: Game): Promise<void>;
  updateStatus(gameId: string, status: GameStatus): Promise<void>;
}

export interface RegistrationRepo {
  get(gameId: string, userId: string): Promise<Registration | null>;
  upsert(reg: Registration): Promise<void>;
  firstWaitlisted(gameId: string): Promise<Registration | null>;
  promoteToConfirmed(regId: string): Promise<void>;
}
```

Реализация — на Prisma; см. §7.

---

## 6) Use‑cases (Application Services)

### 6.1 JoinGame

**Инварианты:** игра `open`, `startsAt>now`, `confirmedCount < capacity`, уникальность `(gameId,userId)`.

```ts
export async function joinGame(gameId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    await advisoryLock(tx, `game:${gameId}`); // §7.2
    const game = await tx.game.findUnique({ where: { id: gameId } });
    if (!game) throw new DomainError('NOT_FOUND');
    if (game.status !== 'open' || game.startsAt <= new Date()) throw new DomainError('GAME_NOT_JOINABLE');

    const confirmedCount = await tx.registration.count({ where: { gameId, status: 'confirmed' } });
    const existing = await tx.registration.findUnique({ where: { gameId_userId: { gameId, userId } } });

    const status = confirmedCount < game.capacity ? 'confirmed' : 'waitlisted';
    if (!existing) {
      await tx.registration.create({ data: { gameId, userId, status } });
    } else if (existing.status !== status) {
      await tx.registration.update({ where: { id: existing.id }, data: { status } });
    }

    await publish({ type: 'PlayerJoined', occurredAt: new Date(), id: uuid(), payload: { gameId, userId, status } });
    return { status };
  }, { isolationLevel: 'Serializable' });
}
```

### 6.2 LeaveGame

```ts
export async function leaveGame(gameId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    await advisoryLock(tx, `game:${gameId}`);
    const reg = await tx.registration.findUnique({ where: { gameId_userId: { gameId, userId } } });
    if (!reg) return { ok: true };
    if (reg.status === 'canceled') return { ok: true };

    await tx.registration.update({ where: { id: reg.id }, data: { status: 'canceled' } });
    await publish(evt('RegistrationCanceled', { gameId, userId }));

    const next = await tx.registration.findFirst({ where: { gameId, status: 'waitlisted' }, orderBy: { createdAt: 'asc' } });
    if (next) {
      await tx.registration.update({ where: { id: next.id }, data: { status: 'confirmed' } });
      await publish(evt('WaitlistedPromoted', { gameId, userId: next.userId }));
    }

    return { ok: true };
  }, { isolationLevel: 'Serializable' });
}
```

### 6.3 MarkPayment (строго после старта)

```ts
export async function markPayment(gameId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const game = await tx.game.findUnique({ where: { id: gameId } });
    if (!game) throw new DomainError('NOT_FOUND');
    if (!(new Date() >= game.startsAt) || !['open','finished'].includes(game.status)) {
      await publish(evt('PaymentAttemptRejectedEarly', { gameId, userId }));
      throw new DomainError('PAYMENT_WINDOW_NOT_OPEN');
    }
    const reg = await tx.registration.findUnique({ where: { gameId_userId: { gameId, userId } } });
    if (!reg || reg.status !== 'confirmed') throw new DomainError('NOT_CONFIRMED');

    await tx.registration.update({ where: { id: reg.id }, data: { paymentStatus: 'paid', paymentMarkedAt: new Date() } });
    await publish(evt('PaymentMarked', { gameId, userId }));
    return { ok: true };
  });
}
```

### 6.4 CreateGame / CloseGame

```ts
export async function createGame(data: { organizerId:string; venueId:string; startsAt:Date; capacity:number; levelTag?:string; priceText?:string; }) {
  const g = await prisma.game.create({ data: { ...data, status: 'open' } });
  await publish(evt('GameCreated', { gameId: g.id, startsAt: g.startsAt.toISOString(), capacity: g.capacity, levelTag: g.levelTag, priceText: g.priceText }));
  await scheduleReminder(g.id, g.startsAt, '24h');
  await scheduleReminder(g.id, g.startsAt, '2h');
  return g;
}

export async function closeGame(gameId: string) {
  await prisma.game.update({ where: { id: gameId }, data: { status: 'closed' } });
  await publish(evt('GameClosed', { gameId }));
}
```

---

## 7) Тонкости реализации (Postgres + Prisma)

### 7.1 Уникальности и индексы

```sql
-- один пользователь не может записаться дважды
create unique index if not exists uq_regs_game_user on registrations(game_id, user_id);
-- быстрый промоушен FIFO
create index if not exists idx_regs_waitlist on registrations(game_id, status, created_at);
-- отбор ближайших игр
create index if not exists idx_games_starts_at on games(starts_at);
```

### 7.2 Блокировки от гонок

* **Isolation:** используем транзакции `Serializable` в Prisma **и/или** advisory locks.
* **Advisory lock:** `select pg_advisory_xact_lock(hashtext($1));` где `$1 = 'game:'+gameId` — сериализует конкурентные join/leave по одной игре.

```ts
async function advisoryLock(tx: any, key: string) {
  await tx.$executeRawUnsafe('select pg_advisory_xact_lock(hashtext($1))', key);
}
```

### 7.3 Idempotency

* Ключи вида: `evt:<type>:<gameId>:<userId>:<bucket>`.
* Для напоминаний — хранить «последнюю отправку» по (gameId,userId,type), не дублировать.

### 7.4 Политики как доменные сервисы

```ts
export async function onRegistrationCanceled(gameId: string) {
  await prisma.$transaction(async (tx) => {
    await advisoryLock(tx, `game:${gameId}`);
    const next = await tx.registration.findFirst({ where: { gameId, status: 'waitlisted' }, orderBy: { createdAt: 'asc' } });
    if (!next) return;
    await tx.registration.update({ where: { id: next.id }, data: { status: 'confirmed' } });
    await publish(evt('WaitlistedPromoted', { gameId, userId: next.userId }));
  });
}
```

---

## 8) Приземление на Prisma (схема — дополнение)

```prisma
enum GameStatus { open closed finished canceled }
enum RegStatus { confirmed waitlisted canceled }
enum PaymentStatus { unpaid paid }

model Game {
  id          String   @id @default(uuid())
  organizerId String
  venueId     String
  startsAt    DateTime
  capacity    Int
  levelTag    String?
  priceText   String?
  status      GameStatus @default(open)
  createdAt   DateTime @default(now())
  registrations Registration[]
}

model Registration {
  id        String   @id @default(uuid())
  gameId    String
  userId    String
  status    RegStatus
  paymentStatus  PaymentStatus @default(unpaid)
  paymentMarkedAt DateTime?
  createdAt DateTime @default(now())
  game      Game     @relation(fields: [gameId], references: [id], onDelete: Cascade)
  @@unique([gameId, userId])
  @@index([gameId, status, createdAt])
}
```

---

## 9) Внешние границы (Bot/API) → Application layer

* **Bot (Telegraf):** команды мапятся на use‑cases (`joinGame`, `leaveGame`, `markPayment`, `createGame`, `closeGame`).
* **API (Fastify, минимально):** `/health`, `/games/upcoming`, `/admin/promoteWaitlist`.

---

## 10) Тестирование (Given‑When‑Then)

* **Join over capacity:** Given `capacity=1`, userA joined, When userB joins, Then userB is `waitlisted`.
* **Leave promotes waitlist:** Given `waitlisted` exists, When confirmed cancels, Then first waitlisted becomes `confirmed`.
* **Payment guard:** Given `now < startsAt`, When `markPayment`, Then `PAYMENT_WINDOW_NOT_OPEN` + событие `PaymentAttemptRejectedEarly`.
* **Idempotent join:** Given user already `confirmed`, When join again, Then статус не меняется.

---

## 11) Эволюция после MVP

* Выделить `Notifications` воркер (BullMQ) и хранить outbox событий.
* Перевести advisory lock → редис‑локи при горизонтальном скейле.
* Добавить `NoShow` евент и счётчик посещаемости.
* Ввести «право организатора отмечать оплату» (двойной контроль).

---

## 12) Быстрые сниппеты для бота (UX тексты)

* Join: «Место забронировано ✅» / «Лист ожидания ⏳ (сообщим, если место освободится)»
* Leave: «Запись отменена. Если освободилось место, пригласили следующего.»
* T‑24: «Напоминание: игра **завтра** в HH:MM, площадка: …»
* T‑2: «Старт через **2 часа** в HH:MM. Не опаздывай!»
* Payment window: «Игра началась. Отметь оплату кнопкой ниже.»
* Paid: «Оплата отмечена 💰 Спасибо!»
