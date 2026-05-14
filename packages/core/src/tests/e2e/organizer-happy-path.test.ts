import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createBot } from '../../../../bot-volley/src/bot/create-bot.js';
import { prisma } from '../../infrastructure/prisma.js';
import { GameStatus } from '../../domain/game.js';
import { PlayerOrganizerStatus } from '@prisma/client';
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
import { VENUE_IDS } from '../../shared/game-constants.js';

const ORG_TG = 930001;
const PLAYER_TG = 930002;

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

describe('e2e organizer happy path', () => {
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

  it('регистрация организатора и полный мастер создания игры', async () => {
    await bot.handleUpdate(
      buildPrivateMessageUpdate({
        updateId: uid++,
        chatId: ORG_TG,
        userId: ORG_TG,
        text: '/start',
        firstName: 'Org',
      })
    );
    let mid = getLastMessageIdForChat(outgoing, ORG_TG);

    await bot.handleUpdate(
      buildCallbackUpdate({
        updateId: uid++,
        chatId: ORG_TG,
        userId: ORG_TG,
        messageId: mid,
        data: 'role_organizer',
      })
    );

    const orgRow = await prisma.organizer.findFirst({
      where: { user: { telegramId: BigInt(ORG_TG) } },
    });
    expect(orgRow).not.toBeNull();

    await bot.handleUpdate(
      buildPrivateMessageUpdate({
        updateId: uid++,
        chatId: ORG_TG,
        userId: ORG_TG,
        text: '/newgame',
      })
    );
    mid = getLastMessageIdForChat(outgoing, ORG_TG);

    await bot.handleUpdate(
      buildCallbackUpdate({
        updateId: uid++,
        chatId: ORG_TG,
        userId: ORG_TG,
        messageId: mid,
        data: 'wizard_date_tomorrow',
      })
    );
    mid = getLastMessageIdForChat(outgoing, ORG_TG);

    await bot.handleUpdate(
      buildCallbackUpdate({
        updateId: uid++,
        chatId: ORG_TG,
        userId: ORG_TG,
        messageId: mid,
        data: 'wizard_time_18',
      })
    );
    mid = getLastMessageIdForChat(outgoing, ORG_TG);

    await bot.handleUpdate(
      buildCallbackUpdate({
        updateId: uid++,
        chatId: ORG_TG,
        userId: ORG_TG,
        messageId: mid,
        data: 'wizard_level_novice',
      })
    );
    mid = getLastMessageIdForChat(outgoing, ORG_TG);

    await bot.handleUpdate(
      buildCallbackUpdate({
        updateId: uid++,
        chatId: ORG_TG,
        userId: ORG_TG,
        messageId: mid,
        data: `wizard_venue_${VENUE_IDS.CHAIKA}`,
      })
    );
    mid = getLastMessageIdForChat(outgoing, ORG_TG);

    await bot.handleUpdate(
      buildCallbackUpdate({
        updateId: uid++,
        chatId: ORG_TG,
        userId: ORG_TG,
        messageId: mid,
        data: 'wizard_capacity_12',
      })
    );
    mid = getLastMessageIdForChat(outgoing, ORG_TG);

    await bot.handleUpdate(
      buildCallbackUpdate({
        updateId: uid++,
        chatId: ORG_TG,
        userId: ORG_TG,
        messageId: mid,
        data: 'wizard_price_125',
      })
    );

    const games = await prisma.game.findMany();
    expect(games.length).toBe(1);
    const createdGame = games[0]!;
    expect(createdGame.venueId).toBe(VENUE_IDS.CHAIKA);
    expect(createdGame.capacity).toBe(12);
    const gameId = createdGame.id;

    await bot.handleUpdate(
      buildPrivateMessageUpdate({
        updateId: uid++,
        chatId: ORG_TG,
        userId: ORG_TG,
        text: `/close ${gameId}`,
      })
    );

    const closed = await prisma.game.findUnique({ where: { id: gameId } });
    expect(closed?.status).toBe(GameStatus.closed);

    await prisma.game.update({
      where: { id: gameId },
      data: { startsAt: new Date(Date.now() - 60 * 60 * 1000) },
    });

    await bot.handleUpdate(
      buildPrivateMessageUpdate({
        updateId: uid++,
        chatId: ORG_TG,
        userId: ORG_TG,
        text: `/payments ${gameId}`,
      })
    );

    expect(
      outgoing.calls.some(
        (c) =>
          c.method === 'sendMessage' &&
          String(c.payload.text).toLowerCase().includes('оплат')
      )
    ).toBe(true);
  });

  it('подтверждение игрока из pending и ответ на приглашение по callback', async () => {
    await bot.handleUpdate(
      buildPrivateMessageUpdate({
        updateId: uid++,
        chatId: ORG_TG,
        userId: ORG_TG,
        text: '/start',
        firstName: 'Org',
      })
    );
    await bot.handleUpdate(
      buildCallbackUpdate({
        updateId: uid++,
        chatId: ORG_TG,
        userId: ORG_TG,
        messageId: getLastMessageIdForChat(outgoing, ORG_TG),
        data: 'role_organizer',
      })
    );

    const organizer = await prisma.organizer.findFirst({
      where: { user: { telegramId: BigInt(ORG_TG) } },
    });
    expect(organizer).not.toBeNull();
    const org = organizer!;

    const playerUser = await prisma.user.create({
      data: { telegramId: BigInt(PLAYER_TG), name: 'Pl', levelTag: 'Новички' },
    });
    await prisma.playerOrganizer.create({
      data: {
        playerId: playerUser.id,
        organizerId: org.id,
        status: PlayerOrganizerStatus.pending,
      },
    });

    await bot.handleUpdate(
      buildPrivateMessageUpdate({
        updateId: uid++,
        chatId: ORG_TG,
        userId: ORG_TG,
        text: '/pendingplayers',
      })
    );

    await bot.handleUpdate(
      buildCallbackUpdate({
        updateId: uid++,
        chatId: ORG_TG,
        userId: ORG_TG,
        messageId: getLastMessageIdForChat(outgoing, ORG_TG),
        data: `confirm_player_${playerUser.id}`,
      })
    );

    const po = await prisma.playerOrganizer.findUnique({
      where: {
        playerId_organizerId: { playerId: playerUser.id, organizerId: org.id },
      },
    });
    expect(po?.status).toBe(PlayerOrganizerStatus.confirmed);

    const startsAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const game = await prisma.game.create({
      data: {
        organizerId: org.id,
        venueId: 'venue-chaika-id',
        startsAt,
        capacity: 10,
        status: GameStatus.open,
        levelTag: 'Новички',
        createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
      },
    });

    await prisma.gamePlayerResponse.create({
      data: {
        gameId: game.id,
        playerId: playerUser.id,
        response: 'ignored',
      },
    });

    await bot.handleUpdate(
      buildPrivateMessageUpdate({
        updateId: uid++,
        chatId: PLAYER_TG,
        userId: PLAYER_TG,
        text: '/start',
        firstName: 'Pl',
      })
    );
    let pmid = getLastMessageIdForChat(outgoing, PLAYER_TG);
    await bot.handleUpdate(
      buildCallbackUpdate({
        updateId: uid++,
        chatId: PLAYER_TG,
        userId: PLAYER_TG,
        messageId: pmid,
        data: 'role_player',
      })
    );
    pmid = getLastMessageIdForChat(outgoing, PLAYER_TG);
    await bot.handleUpdate(
      buildCallbackUpdate({
        updateId: uid++,
        chatId: PLAYER_TG,
        userId: PLAYER_TG,
        messageId: pmid,
        data: 'level_novice',
      })
    );

    await bot.handleUpdate(
      buildCallbackUpdate({
        updateId: uid++,
        chatId: PLAYER_TG,
        userId: PLAYER_TG,
        messageId: getLastMessageIdForChat(outgoing, PLAYER_TG),
        data: `respond_game_${game.id}_yes`,
      })
    );

    const gpr = await prisma.gamePlayerResponse.findUnique({
      where: { gameId_playerId: { gameId: game.id, playerId: playerUser.id } },
    });
    expect(gpr?.response).toBe('yes');
  });
});
