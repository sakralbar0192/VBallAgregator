import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { BusinessRuleError } from '../domain/errors/business-rule-error.js';
import { InvitationApplicationService } from '../application/services/invitation-service.js';
import { EventBus } from '../shared/event-bus.js';
import { prisma } from '../infrastructure/prisma.js';
import { clearDatabase, createTestOrganizer } from './test-db-helpers.js';

describe('InvitationApplicationService edge cases', () => {
  let svc: InvitationApplicationService;

  beforeEach(async () => {
    await clearDatabase();
    svc = new InvitationApplicationService(EventBus.getInstance());
  }, 15000);

  afterEach(async () => {
    await clearDatabase();
  }, 15000);

  it('respondToGameInvitation throws when game missing', async () => {
    const u = await prisma.user.create({
      data: { telegramId: 60001n, name: 'P' },
    });

    await expect(
      svc.respondToGameInvitation('00000000-0000-4000-8000-000000000001', u.id, 'yes')
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('respondToGameInvitation throws when player not confirmed for organizer', async () => {
    const { organizer } = await createTestOrganizer(60002n, 'O', 'T');
    const player = await prisma.user.create({
      data: { telegramId: 60003n, name: 'P' },
    });

    const game = await prisma.game.create({
      data: {
        organizerId: organizer.id,
        venueId: 'venue-1',
        startsAt: new Date(Date.now() + 3600_000),
        capacity: 4,
        status: 'open',
        createdAt: new Date(Date.now() - 4 * 3600_000),
      },
    });

    await expect(
      svc.respondToGameInvitation(game.id, player.id, 'yes')
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('notifyConfirmedPlayersAboutGame throws when game missing', async () => {
    await expect(
      svc.notifyConfirmedPlayersAboutGame('00000000-0000-4000-8000-000000000099')
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it('checkPriorityWindowExpiration returns early when window not elapsed', async () => {
    const { organizer } = await createTestOrganizer(60004n, 'O', 'T');
    const game = await prisma.game.create({
      data: {
        organizerId: organizer.id,
        venueId: 'venue-1',
        startsAt: new Date(Date.now() + 7200_000),
        capacity: 4,
        status: 'open',
        createdAt: new Date(),
      },
    });

    await expect(svc.checkPriorityWindowExpiration(game.id)).resolves.toBeUndefined();
  });
});
