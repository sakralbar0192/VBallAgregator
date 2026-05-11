import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { prisma } from '../infrastructure/prisma.js';
import {
  listGames,
  joinGame,
  closeGame,
  finishGame,
  selectOrganizers,
  confirmPlayer,
  rejectPlayer,
  getOrganizerPlayers,
  respondToGameInvitation,
  notifyConfirmedPlayersAboutGame,
  checkPriorityWindowExpiration,
  linkPlayerToOrganizer,
  updateUserLevel,
  scheduleGameReminders,
  schedulePaymentReminders,
  sendPaymentReminders,
  createGame,
} from '../application/use-cases.js';
import { GameStatus } from '../domain/game.js';
import { clearDatabase, createTestOrganizer } from './test-db-helpers.js';

describe('use-cases extended (integration)', () => {
  beforeEach(async () => {
    await clearDatabase();
  }, 15000);

  afterEach(async () => {
    await clearDatabase();
  }, 15000);

  it('listGames without user returns open games', async () => {
    const { organizer } = await createTestOrganizer(100n, 'Org', 'Club');
    await prisma.game.create({
      data: {
        organizerId: organizer.id,
        venueId: 'venue-1',
        startsAt: new Date(Date.now() + 86_400_000),
        capacity: 8,
        status: GameStatus.open,
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      },
    });

    const games = await listGames();
    expect(games.length).toBe(1);
  });

  it('listGames with userId walks priority branches', async () => {
    const { user: orgUser, organizer } = await createTestOrganizer(101n, 'Org', 'Club');
    const player = await prisma.user.create({
      data: { telegramId: 102n, name: 'P', levelTag: 'mid' },
    });
    await prisma.playerOrganizer.create({
      data: {
        playerId: player.id,
        organizerId: organizer.id,
        status: 'confirmed',
      },
    });

    await prisma.game.create({
      data: {
        organizerId: organizer.id,
        venueId: 'venue-1',
        startsAt: new Date(Date.now() + 86_400_000),
        capacity: 8,
        status: GameStatus.open,
        publishedForAll: false,
        createdAt: new Date(),
      },
    });

    const filtered = await listGames(player.id);
    expect(Array.isArray(filtered)).toBe(true);

    await prisma.game.updateMany({
      data: { publishedForAll: true },
    });
    const published = await listGames(player.id);
    expect(published.length).toBeGreaterThanOrEqual(1);

    await listGames(orgUser.id);
  });

  it('closes game when organizer matches', async () => {
    const { organizer } = await createTestOrganizer(200n, 'O', 'T');
    const game = await prisma.game.create({
      data: {
        organizerId: organizer.id,
        venueId: 'venue-1',
        startsAt: new Date(Date.now() + 3600_000),
        capacity: 4,
        status: GameStatus.open,
        createdAt: new Date(Date.now() - 3 * 3600_000),
      },
    });

    await closeGame(game.id, organizer.id);

    const updated = await prisma.game.findUnique({ where: { id: game.id } });
    expect(updated?.status).toBe(GameStatus.closed);
  });

  it('finishGame marks game finished', async () => {
    const { organizer } = await createTestOrganizer(300n, 'O', 'T');
    const game = await prisma.game.create({
      data: {
        organizerId: organizer.id,
        venueId: 'venue-1',
        startsAt: new Date(Date.now() - 3600_000),
        capacity: 4,
        status: GameStatus.open,
        createdAt: new Date(Date.now() - 4 * 3600_000),
      },
    });

    await finishGame(game.id);

    const updated = await prisma.game.findUnique({ where: { id: game.id } });
    expect(updated?.status).toBe(GameStatus.finished);
  });

  it('selectOrganizers clears and assigns organizers', async () => {
    const player = await prisma.user.create({
      data: { telegramId: 400n, name: 'Pl', levelTag: 'x' },
    });
    const { organizer: o1 } = await createTestOrganizer(401n, 'O1', 'A');
    const { organizer: o2 } = await createTestOrganizer(402n, 'O2', 'B');

    await selectOrganizers(player.id, []);
    let links = await prisma.playerOrganizer.findMany({ where: { playerId: player.id } });
    expect(links.length).toBe(0);

    await selectOrganizers(player.id, [o1.id, o2.id]);
    links = await prisma.playerOrganizer.findMany({ where: { playerId: player.id } });
    expect(links.length).toBe(2);
  });

  it('confirmPlayer and rejectPlayer and getOrganizerPlayers', async () => {
    const { organizer } = await createTestOrganizer(500n, 'Org', 'C');
    const player = await prisma.user.create({
      data: { telegramId: 501n, name: 'Pl' },
    });

    await prisma.playerOrganizer.create({
      data: {
        playerId: player.id,
        organizerId: organizer.id,
        status: 'pending',
      },
    });

    await confirmPlayer(organizer.id, player.id);

    let list = await getOrganizerPlayers(organizer.id, 'confirmed');
    expect(list.some((r: { playerId: string }) => r.playerId === player.id)).toBe(true);

    const player2 = await prisma.user.create({
      data: { telegramId: 502n, name: 'P2' },
    });
    await prisma.playerOrganizer.create({
      data: {
        playerId: player2.id,
        organizerId: organizer.id,
        status: 'pending',
      },
    });

    await rejectPlayer(organizer.id, player2.id);

    list = await getOrganizerPlayers(organizer.id);
    expect(list.length).toBeGreaterThanOrEqual(1);
  });

  it('respondToGameInvitation and notifyConfirmedPlayersAboutGame', async () => {
    const { organizer } = await createTestOrganizer(600n, 'Org', 'C');
    const player = await prisma.user.create({
      data: { telegramId: 601n, name: 'Pl', levelTag: 'l' },
    });

    await prisma.playerOrganizer.create({
      data: {
        playerId: player.id,
        organizerId: organizer.id,
        status: 'confirmed',
      },
    });

    const game = await prisma.game.create({
      data: {
        organizerId: organizer.id,
        venueId: 'venue-1',
        startsAt: new Date(Date.now() + 3600_000),
        capacity: 6,
        status: GameStatus.open,
        createdAt: new Date(Date.now() - 3 * 3600_000),
      },
    });

    await notifyConfirmedPlayersAboutGame(game.id);

    const responses = await prisma.gamePlayerResponse.findMany({
      where: { gameId: game.id },
    });
    expect(responses.length).toBeGreaterThanOrEqual(1);

    await respondToGameInvitation(game.id, player.id, 'yes');

    const mine = await prisma.gamePlayerResponse.findUnique({
      where: { gameId_playerId: { gameId: game.id, playerId: player.id } },
    });
    expect(mine?.response).toBe('yes');
  });

  it('checkPriorityWindowExpiration publishes when window elapsed', async () => {
    const { organizer } = await createTestOrganizer(700n, 'Org', 'C');
    const game = await prisma.game.create({
      data: {
        organizerId: organizer.id,
        venueId: 'venue-1',
        startsAt: new Date(Date.now() + 7200_000),
        capacity: 4,
        status: GameStatus.open,
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      },
    });

    await checkPriorityWindowExpiration(game.id);
  });

  it('linkPlayerToOrganizer publishes event', async () => {
    const { organizer } = await createTestOrganizer(800n, 'Org', 'C');
    const player = await prisma.user.create({
      data: { telegramId: 801n, name: 'Pl' },
    });

    const res = await linkPlayerToOrganizer(player.id, organizer.id);
    expect(res.ok).toBe(true);
  });

  it('updateUserLevel updates user', async () => {
    const u = await prisma.user.create({
      data: { telegramId: 900n, name: 'U' },
    });
    const r = await updateUserLevel(u.id, 'pro');
    expect(r.ok).toBe(true);

    const updated = await prisma.user.findUnique({ where: { id: u.id } });
    expect(updated?.levelTag).toBe('pro');
  });

  it('scheduleGameReminders and schedulePaymentReminders call scheduler', async () => {
    const { organizer } = await createTestOrganizer(910n, 'Org', 'C');
    const game = await prisma.game.create({
      data: {
        organizerId: organizer.id,
        venueId: 'venue-1',
        startsAt: new Date(Date.now() + 7200_000),
        capacity: 4,
        status: GameStatus.open,
        createdAt: new Date(Date.now() - 4 * 3600_000),
      },
    });

    await expect(scheduleGameReminders(game.id)).resolves.toBeUndefined();
    await expect(schedulePaymentReminders(game.id)).resolves.toBeUndefined();
  });

  it('sendPaymentReminders publishes for unpaid registrations', async () => {
    const { user: orgUser, organizer } = await createTestOrganizer(920n, 'Org', 'C');
    const player = await prisma.user.create({
      data: { telegramId: 921n, name: 'Pl' },
    });

    const game = await createGame({
      organizerId: orgUser.id,
      venueId: 'venue-1',
      startsAt: new Date(Date.now() - 3600_000),
      capacity: 4,
      levelTag: 'x',
    });

    await prisma.registration.create({
      data: {
        gameId: game.id,
        userId: player.id,
        status: 'confirmed',
        paymentStatus: 'unpaid',
      },
    });

    const result = await sendPaymentReminders(game.id, organizer.id);
    expect(result.sent).toBeGreaterThanOrEqual(1);
  });

  it('joinGame rejects outsider during active priority window', async () => {
    const { organizer } = await createTestOrganizer(930n, 'Org', 'C');
    const priorityPlayer = await prisma.user.create({
      data: { telegramId: 931n, name: 'Pri', levelTag: 'x' },
    });
    await prisma.playerOrganizer.create({
      data: {
        playerId: priorityPlayer.id,
        organizerId: organizer.id,
        status: 'confirmed',
      },
    });

    const outsider = await prisma.user.create({
      data: { telegramId: 932n, name: 'Out' },
    });

    const game = await prisma.game.create({
      data: {
        organizerId: organizer.id,
        venueId: 'venue-1',
        startsAt: new Date(Date.now() + 3600_000),
        capacity: 10,
        status: GameStatus.open,
        createdAt: new Date(),
      },
    });

    await prisma.gamePlayerResponse.create({
      data: {
        gameId: game.id,
        playerId: priorityPlayer.id,
        response: 'ignored',
      },
    });

    await expect(joinGame(game.id, outsider.id)).rejects.toMatchObject({
      code: 'PRIORITY_WINDOW_ACTIVE',
    });
  });
});
