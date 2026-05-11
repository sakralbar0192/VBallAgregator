import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { prisma } from '../infrastructure/prisma.js';
import { GameStatus } from '../domain/game.js';
import { clearDatabase } from './test-db-helpers.js';
import { GetUserRegistrationsQuery } from '../application/queries/GetUserRegistrationsQuery.js';
import { GamePaymentsDashboardQuery } from '../application/queries/GamePaymentsDashboardQuery.js';

describe('queries integration', () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  it('GetUserRegistrationsQuery returns registrations', async () => {
    const u = await prisma.user.create({ data: { telegramId: 1n, name: 'U' } });
    const org = await prisma.organizer.create({ data: { userId: u.id, title: 'O' } });
    const g = await prisma.game.create({
      data: {
        organizerId: org.id,
        venueId: 'venue-chaika-id',
        startsAt: new Date(Date.now() + 3600_000),
        capacity: 10,
        status: GameStatus.open,
      },
    });
    await prisma.registration.create({
      data: {
        gameId: g.id,
        userId: u.id,
        status: 'confirmed',
        paymentStatus: 'unpaid',
      },
    });

    const rows = await new GetUserRegistrationsQuery(u.id).execute();
    expect(rows.length).toBe(1);
    expect(rows[0]!.game?.id).toBe(g.id);
  });

  it('GamePaymentsDashboardQuery aggregates payments', async () => {
    const orgUser = await prisma.user.create({ data: { telegramId: 2n, name: 'Org' } });
    const plUser = await prisma.user.create({ data: { telegramId: 3n, name: 'Pl' } });
    const org = await prisma.organizer.create({ data: { userId: orgUser.id, title: 'O' } });
    const g = await prisma.game.create({
      data: {
        organizerId: org.id,
        venueId: 'venue-chaika-id',
        startsAt: new Date(Date.now() + 3600_000),
        capacity: 10,
        status: GameStatus.open,
      },
    });
    await prisma.registration.create({
      data: {
        gameId: g.id,
        userId: plUser.id,
        status: 'confirmed',
        paymentStatus: 'unpaid',
      },
    });

    const dash = await new GamePaymentsDashboardQuery(g.id, org.id).execute();
    expect(dash.players.length).toBe(1);
    expect(dash.unpaidCount).toBe(1);
    expect(dash.paidCount).toBe(0);
  });
});
