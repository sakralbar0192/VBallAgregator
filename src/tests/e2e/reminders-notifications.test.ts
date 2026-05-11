import { describe, it, expect, beforeAll, beforeEach, afterEach, jest } from '@jest/globals';
import { createBot } from '../../bot/create-bot.js';
import { prisma } from '../../infrastructure/prisma.js';
import { GameStatus } from '../../domain/game.js';
import { EventBus } from '../../shared/event-bus.js';
import { rateLimiter } from '../../shared/rate-limiter.js';
import { idempotencyService } from '../../shared/idempotency-service.js';
import { sessionManager } from '../../shared/session-manager.js';
import { GameCreationWizard } from '../../bot/game-creation-wizard.js';
import { CommandHandlers } from '../../bot/command-handlers.js';
import { clearDatabase } from '../test-db-helpers.js';
import {
  patchTelegramApiClient,
  buildCallbackUpdate,
  resetTelegramHarnessSeq,
  type ApiCallRecord,
} from './telegram-harness.js';
import { ensureE2eEventHandlersRegistered } from './ensure-event-handlers.js';

const ORG_TG = 925001;
const PLAYER_TG = 925002;

function sendsToChat(
  calls: ApiCallRecord[],
  chatId: number,
  predicate: (text: string) => boolean
): boolean {
  return calls.some(
    (c) =>
      c.method === 'sendMessage' &&
      Number(c.payload.chat_id) === chatId &&
      predicate(String(c.payload.text ?? ''))
  );
}

describe('e2e напоминания игрокам (игра и оплата)', () => {
  const outgoing: { calls: ApiCallRecord[] } = { calls: [] };
  let bot: Awaited<ReturnType<typeof createBot>>;
  let uid = 1;
  let unpatchApi: (() => void) | undefined;
  let checkQuotaSpy: jest.SpiedFunction<typeof rateLimiter.checkTelegramQuota>;
  let consumeQuotaSpy: jest.SpiedFunction<typeof rateLimiter.consumeTelegramQuota>;
  let idempotencySpy: jest.SpiedFunction<typeof idempotencyService.ensureNotSentRecently>;

  beforeAll(async () => {
    await ensureE2eEventHandlersRegistered();
  });

  beforeEach(async () => {
    resetTelegramHarnessSeq();
    outgoing.calls = [];
    unpatchApi = patchTelegramApiClient(outgoing);
    sessionManager.terminate();
    GameCreationWizard.resetSessionsForTests();
    CommandHandlers.resetOrganizerSessionsForTests();

    checkQuotaSpy = jest.spyOn(rateLimiter, 'checkTelegramQuota').mockResolvedValue(true);
    consumeQuotaSpy = jest.spyOn(rateLimiter, 'consumeTelegramQuota').mockResolvedValue(undefined);
    idempotencySpy = jest
      .spyOn(idempotencyService, 'ensureNotSentRecently')
      .mockResolvedValue(true);

    await clearDatabase();
    bot = await createBot({ skipRateLimit: true });
  });

  afterEach(async () => {
    checkQuotaSpy.mockRestore();
    consumeQuotaSpy.mockRestore();
    idempotencySpy.mockRestore();
    unpatchApi?.();
    unpatchApi = undefined;
    await clearDatabase();
  });

  async function seedOrganizerPlayerAndUnpaidGame(): Promise<{
    gameId: string;
    organizerUserId: string;
    organizerRecordId: string;
  }> {
    const orgUser = await prisma.user.create({
      data: { telegramId: BigInt(ORG_TG), name: 'Org R' },
    });
    const organizer = await prisma.organizer.create({
      data: { userId: orgUser.id, title: 'Club R' },
    });
    const playerUser = await prisma.user.create({
      data: { telegramId: BigInt(PLAYER_TG), name: 'Player R' },
    });
    const startsAtPast = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const game = await prisma.game.create({
      data: {
        organizerId: organizer.id,
        venueId: 'venue-chaika-id',
        startsAt: startsAtPast,
        capacity: 10,
        status: GameStatus.finished,
        levelTag: 'Любители',
        priceText: '500₽',
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    });
    await prisma.registration.create({
      data: {
        gameId: game.id,
        userId: playerUser.id,
        status: 'confirmed',
        paymentStatus: 'unpaid',
      },
    });
    return {
      gameId: game.id,
      organizerUserId: orgUser.id,
      organizerRecordId: organizer.id,
    };
  }

  it('ручное напоминание об оплате: callback remind_payments_* шлёт сообщение игроку', async () => {
    const { gameId } = await seedOrganizerPlayerAndUnpaidGame();

    const midBefore = outgoing.calls.length;

    await bot.handleUpdate(
      buildCallbackUpdate({
        updateId: uid++,
        chatId: ORG_TG,
        userId: ORG_TG,
        messageId: 500,
        data: `remind_payments_${gameId}`,
      })
    );

    expect(outgoing.calls.length).toBeGreaterThan(midBefore);
    expect(
      sendsToChat(outgoing.calls, PLAYER_TG, (t) =>
        /Напоминание об оплате|\/pay/i.test(t)
      )
    ).toBe(true);
  });

  it('напоминание за 24 ч до игры (событие GameReminder24h)', async () => {
    const orgUser = await prisma.user.create({
      data: { telegramId: BigInt(ORG_TG), name: 'O' },
    });
    const organizer = await prisma.organizer.create({
      data: { userId: orgUser.id, title: 'C' },
    });
    const playerUser = await prisma.user.create({
      data: { telegramId: BigInt(PLAYER_TG), name: 'P' },
    });
    const game = await prisma.game.create({
      data: {
        organizerId: organizer.id,
        venueId: 'venue-chaika-id',
        startsAt: new Date(Date.now() + 26 * 60 * 60 * 1000),
        capacity: 8,
        status: GameStatus.open,
        levelTag: 'Любители',
        priceText: '300₽',
        createdAt: new Date(Date.now() - 60 * 60 * 1000),
      },
    });
    await prisma.registration.create({
      data: {
        gameId: game.id,
        userId: playerUser.id,
        status: 'confirmed',
        paymentStatus: 'unpaid',
      },
    });

    outgoing.calls.length = 0;

    await EventBus.getInstance().publish({
      type: 'GameReminder24h',
      occurredAt: new Date(),
      id: '',
      payload: { gameId: game.id },
    });

    expect(
      sendsToChat(outgoing.calls, PLAYER_TG, (t) =>
        /Напоминание.*игра завтра|⏰/i.test(t)
      )
    ).toBe(true);
  });

  it('напоминание за 2 ч до игры (событие GameReminder2h)', async () => {
    const orgUser = await prisma.user.create({
      data: { telegramId: BigInt(ORG_TG), name: 'O' },
    });
    const organizer = await prisma.organizer.create({
      data: { userId: orgUser.id, title: 'C' },
    });
    const playerUser = await prisma.user.create({
      data: { telegramId: BigInt(PLAYER_TG), name: 'P' },
    });
    const game = await prisma.game.create({
      data: {
        organizerId: organizer.id,
        venueId: 'venue-chaika-id',
        startsAt: new Date(Date.now() + 90 * 60 * 1000),
        capacity: 8,
        status: GameStatus.open,
        levelTag: 'Любители',
        createdAt: new Date(Date.now() - 60 * 60 * 1000),
      },
    });
    await prisma.registration.create({
      data: {
        gameId: game.id,
        userId: playerUser.id,
        status: 'confirmed',
        paymentStatus: 'unpaid',
      },
    });

    outgoing.calls.length = 0;

    await EventBus.getInstance().publish({
      type: 'GameReminder2h',
      occurredAt: new Date(),
      id: '',
      payload: { gameId: game.id },
    });

    expect(
      sendsToChat(outgoing.calls, PLAYER_TG, (t) =>
        /Через 2 часа|🚨/i.test(t)
      )
    ).toBe(true);
  });

  it('авто напоминание об оплате 12 ч (событие PaymentReminder12h)', async () => {
    const { gameId } = await seedOrganizerPlayerAndUnpaidGame();

    outgoing.calls.length = 0;

    await EventBus.getInstance().publish({
      type: 'PaymentReminder12h',
      occurredAt: new Date(),
      id: '',
      payload: { gameId },
    });

    expect(
      sendsToChat(outgoing.calls, PLAYER_TG, (t) =>
        /Напоминание: оплат|произведите оплату/i.test(t)
      )
    ).toBe(true);
  });

  it('авто напоминание об оплате 24 ч (событие PaymentReminder24h)', async () => {
    const { gameId } = await seedOrganizerPlayerAndUnpaidGame();

    outgoing.calls.length = 0;

    await EventBus.getInstance().publish({
      type: 'PaymentReminder24h',
      occurredAt: new Date(),
      id: '',
      payload: { gameId },
    });

    expect(
      sendsToChat(outgoing.calls, PLAYER_TG, (t) =>
        /Последнее напоминание об оплате|Просьба оплатить/i.test(t)
      )
    ).toBe(true);
  });
});
