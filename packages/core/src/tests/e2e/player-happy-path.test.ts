import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createBot } from '../../../../bot-volley/src/bot/create-bot.js';
import { prisma } from '../../infrastructure/prisma.js';
import { GameStatus } from '../../domain/game.js';
import { sessionManager } from '../../shared/session-manager.js';
import { GameCreationWizard } from '../../../../bot-volley/src/bot/game-creation-wizard.js';
import { CommandHandlers } from '../../../../bot-volley/src/bot/command-handlers.js';
import { clearDatabase } from '../test-db-helpers.js';
import {
  patchTelegramApiClient,
  buildPrivateMessageUpdate,
  buildCallbackUpdate,
  resetTelegramHarnessSeq,
  type ApiCallRecord,
} from './telegram-harness.js';

const ORG_TG = 920001;
const PLAYER_TG = 920002;

function getLastMessageIdForChat(store: { calls: ApiCallRecord[] }, chatId: number): number {
  let mid = 1;
  for (const c of store.calls) {
    if (c.method === 'sendMessage' && Number(c.payload.chat_id) === chatId) {
      mid = (c.response as { message_id: number }).message_id;
    }
    if (c.method === 'editMessageText' && Number(c.payload.chat_id) === chatId) {
      mid = (c.response as { message_id: number }).message_id;
    }
  }
  return mid;
}

describe('e2e player happy path', () => {
  const outgoing: { calls: ApiCallRecord[] } = { calls: [] };
  let bot: Awaited<ReturnType<typeof createBot>>;
  let uid = 1;
  let unpatchApi: (() => void) | undefined;

  beforeEach(async () => {
    resetTelegramHarnessSeq();
    outgoing.calls = [];
    unpatchApi = patchTelegramApiClient(outgoing);
    sessionManager.terminate();
    GameCreationWizard.resetSessionsForTests();
    CommandHandlers.resetOrganizerSessionsForTests();
    await clearDatabase();
    bot = await createBot({ skipRateLimit: true });
  });

  afterEach(async () => {
    unpatchApi?.();
    unpatchApi = undefined;
    await clearDatabase();
  });

  it('регистрация игрока, список игр, join, my, leave; оплата после старта игры', async () => {
    await bot.handleUpdate(
      buildPrivateMessageUpdate({
        updateId: uid++,
        chatId: PLAYER_TG,
        userId: PLAYER_TG,
        text: '/start',
        firstName: 'Player',
      })
    );
    let mid = getLastMessageIdForChat(outgoing, PLAYER_TG);

    await bot.handleUpdate(
      buildCallbackUpdate({
        updateId: uid++,
        chatId: PLAYER_TG,
        userId: PLAYER_TG,
        messageId: mid,
        data: 'role_player',
      })
    );
    mid = getLastMessageIdForChat(outgoing, PLAYER_TG);

    await bot.handleUpdate(
      buildCallbackUpdate({
        updateId: uid++,
        chatId: PLAYER_TG,
        userId: PLAYER_TG,
        messageId: mid,
        data: 'level_novice',
      })
    );

    const player = await prisma.user.findUnique({ where: { telegramId: BigInt(PLAYER_TG) } });
    expect(player?.levelTag).toBeTruthy();

    const orgUser = await prisma.user.create({
      data: { telegramId: BigInt(ORG_TG), name: 'Org E2E' },
    });
    const organizer = await prisma.organizer.create({
      data: { userId: orgUser.id, title: 'Club' },
    });
    const startsAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
    const game = await prisma.game.create({
      data: {
        organizerId: organizer.id,
        venueId: 'venue-chaika-id',
        startsAt,
        capacity: 12,
        status: GameStatus.open,
        levelTag: 'Любители',
        createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
      },
    });

    await bot.handleUpdate(
      buildPrivateMessageUpdate({
        updateId: uid++,
        chatId: PLAYER_TG,
        userId: PLAYER_TG,
        text: '/games',
      })
    );
    expect(outgoing.calls.some((c) => c.method === 'sendMessage' && String(c.payload.text).includes('Доступные игры'))).toBe(true);

    await bot.handleUpdate(
      buildPrivateMessageUpdate({
        updateId: uid++,
        chatId: PLAYER_TG,
        userId: PLAYER_TG,
        text: `/join ${game.id}`,
      })
    );

    const reg = await prisma.registration.findFirst({
      where: { gameId: game.id, userId: player!.id },
    });
    expect(reg?.status).toBe('confirmed');

    await bot.handleUpdate(
      buildPrivateMessageUpdate({
        updateId: uid++,
        chatId: PLAYER_TG,
        userId: PLAYER_TG,
        text: '/my',
      })
    );

    await bot.handleUpdate(
      buildPrivateMessageUpdate({
        updateId: uid++,
        chatId: PLAYER_TG,
        userId: PLAYER_TG,
        text: `/leave ${game.id}`,
      })
    );

    const regAfter = await prisma.registration.findFirst({
      where: { gameId: game.id, userId: player!.id },
    });
    expect(regAfter?.status).toBe('canceled');

    await prisma.registration.update({
      where: { id: regAfter!.id },
      data: { status: 'confirmed' },
    });

    await prisma.game.update({
      where: { id: game.id },
      data: { startsAt: new Date(Date.now() - 60 * 60 * 1000) },
    });

    await bot.handleUpdate(
      buildPrivateMessageUpdate({
        updateId: uid++,
        chatId: PLAYER_TG,
        userId: PLAYER_TG,
        text: `/pay ${game.id}`,
      })
    );

    const paid = await prisma.registration.findFirst({
      where: { gameId: game.id, userId: player!.id },
    });
    expect(paid?.paymentStatus).toBe('paid');

    await bot.handleUpdate(
      buildPrivateMessageUpdate({
        updateId: uid++,
        chatId: PLAYER_TG,
        userId: PLAYER_TG,
        text: '/menu',
      })
    );
    await bot.handleUpdate(
      buildPrivateMessageUpdate({
        updateId: uid++,
        chatId: PLAYER_TG,
        userId: PLAYER_TG,
        text: '/help',
      })
    );
  });
});
