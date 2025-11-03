import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { prisma } from '../infrastructure/prisma.js';
import { joinGame, leaveGame, markPayment, createGame, linkPlayerToOrganizer } from '../application/use-cases.js';
import { GameStatus } from '../domain/game.js';
import { RegStatus } from '../domain/registration.js';

describe('Race Conditions Test', () => {
  beforeEach(async () => {
    // Clean up in correct order to avoid foreign key constraints
    await prisma.registration.deleteMany();
    await prisma.game.deleteMany();
    await prisma.organizer.deleteMany();
    await prisma.user.deleteMany();
  }, 10000);

  afterEach(async () => {
    // Clean up in correct order to avoid foreign key constraints
    await prisma.registration.deleteMany();
    await prisma.game.deleteMany();
    await prisma.organizer.deleteMany();
    await prisma.user.deleteMany();
  }, 10000);

  it('should handle concurrent joinGame calls correctly', async () => {
    // Given: create game with capacity 1
    const user1 = await prisma.user.create({
      data: { telegramId: 111111111n, name: 'User 1' }
    });
    const user2 = await prisma.user.create({
      data: { telegramId: 222222222n, name: 'User 2' }
    });
    const organizer = await prisma.organizer.create({
      data: { userId: user1.id, title: 'Test Organizer' }
    });
    const game = await prisma.game.create({
      data: {
        organizerId: organizer.id,
        venueId: 'venue1',
        startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        capacity: 1,
        status: GameStatus.open
      }
    });

    // When: both users try to join simultaneously
    const promises = [
      joinGame(game.id, user1.id),
      joinGame(game.id, user2.id)
    ];

    const results = await Promise.all(promises);

    // Then: exactly one should be confirmed, one waitlisted
    const confirmedCount = results.filter(r => r.status === RegStatus.confirmed).length;
    const waitlistedCount = results.filter(r => r.status === RegStatus.waitlisted).length;

    expect(confirmedCount).toBe(1);
    expect(waitlistedCount).toBe(1);

    // Verify in database
    const registrations = await prisma.registration.findMany({
      where: { gameId: game.id }
    });
    const dbConfirmedCount = registrations.filter((r: any) => r.status === RegStatus.confirmed).length;
    const dbWaitlistedCount = registrations.filter((r: any) => r.status === RegStatus.waitlisted).length;

    expect(dbConfirmedCount).toBe(1);
    expect(dbWaitlistedCount).toBe(1);
  }, 10000);
});

describe('Game Registration Use Cases', () => {
  beforeEach(async () => {
    // Clean up database
    await prisma.registration.deleteMany();
    await prisma.game.deleteMany();
    await prisma.organizer.deleteMany();
    await prisma.user.deleteMany();
  });

  afterEach(async () => {
    // Clean up after each test
    await prisma.registration.deleteMany();
    await prisma.game.deleteMany();
    await prisma.organizer.deleteMany();
    await prisma.user.deleteMany();
  }, 10000);

  describe('joinGame', () => {
    it('should allow joining an open game with available capacity', async () => {
      // Given: create user and game
      const user = await prisma.user.create({
        data: { telegramId: 123456789n, name: 'Test User' }
      });
      const organizer = await prisma.organizer.create({
        data: { userId: user.id, title: 'Test Organizer' }
      });
      const game = await prisma.game.create({
        data: {
          organizerId: organizer.id,
          venueId: 'venue1',
          startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // tomorrow
          capacity: 10,
          status: GameStatus.open
        }
      });

      // When: user joins
      const result = await joinGame(game.id, user.id);

      // Then: should be confirmed
      expect(result.status).toBe(RegStatus.confirmed);

      const registration = await prisma.registration.findFirst({
        where: { gameId: game.id, userId: user.id }
      });
      expect(registration?.status).toBe(RegStatus.confirmed);
    }, 10000);

    it('should put user in waitlist when capacity is reached', async () => {
      // Given: create game with capacity 1 and one existing registration
      const user1 = await prisma.user.create({
        data: { telegramId: 123456789n, name: 'User 1' }
      });
      const user2 = await prisma.user.create({
        data: { telegramId: 987654321n, name: 'User 2' }
      });
      const organizer = await prisma.organizer.create({
        data: { userId: user1.id, title: 'Test Organizer' }
      });
      const game = await prisma.game.create({
        data: {
          organizerId: organizer.id,
          venueId: 'venue1',
          startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          capacity: 1,
          status: GameStatus.open
        }
      });

      // First user joins and gets confirmed
      await joinGame(game.id, user1.id);

      // When: second user tries to join
      const result = await joinGame(game.id, user2.id);

      // Then: should be waitlisted
      expect(result.status).toBe(RegStatus.waitlisted);

      const registration = await prisma.registration.findFirst({
        where: { gameId: game.id, userId: user2.id }
      });
      expect(registration?.status).toBe(RegStatus.waitlisted);
    }, 10000);

    it('should reject joining a game that already started', async () => {
      // Given: create game that already started
      const user = await prisma.user.create({
        data: { telegramId: 123456789n, name: 'Test User' }
      });
      const organizer = await prisma.organizer.create({
        data: { userId: user.id, title: 'Test Organizer' }
      });
      const game = await prisma.game.create({
        data: {
          organizerId: organizer.id,
          venueId: 'venue1',
          startsAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
          capacity: 10,
          status: GameStatus.open
        }
      });

      // When & Then: should throw error
      await expect(joinGame(game.id, user.id)).rejects.toThrow('Игра уже началась');
    }, 10000);
  });

  describe('leaveGame', () => {
    it('should allow leaving a game and promote waitlisted user', async () => {
      // Given: game with confirmed user and waitlisted user
      const user1 = await prisma.user.create({
        data: { telegramId: 123456789n, name: 'User 1' }
      });
      const user2 = await prisma.user.create({
        data: { telegramId: 987654321n, name: 'User 2' }
      });
      const organizer = await prisma.organizer.create({
        data: { userId: user1.id, title: 'Test Organizer' }
      });
      const game = await prisma.game.create({
        data: {
          organizerId: organizer.id,
          venueId: 'venue1',
          startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          capacity: 1,
          status: GameStatus.open
        }
      });

      await joinGame(game.id, user1.id); // confirmed
      await joinGame(game.id, user2.id); // waitlisted

      // When: confirmed user leaves
      await leaveGame(game.id, user1.id);

      // Then: waitlisted user should be promoted
      const promotedReg = await prisma.registration.findFirst({
        where: { gameId: game.id, userId: user2.id }
      });
      expect(promotedReg?.status).toBe(RegStatus.confirmed);
    }, 10000);
  });

  describe('markPayment', () => {
    it('should allow marking payment after game starts', async () => {
      // Given: game that already started with confirmed registration
      const user = await prisma.user.create({
        data: { telegramId: 123456789n, name: 'Test User' }
      });
      const organizer = await prisma.organizer.create({
        data: { userId: user.id, title: 'Test Organizer' }
      });
      const game = await prisma.game.create({
        data: {
          organizerId: organizer.id,
          venueId: 'venue1',
          startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // tomorrow
          capacity: 10,
          status: GameStatus.open
        }
      });

      await joinGame(game.id, user.id);

      // Update game to have started
      await prisma.game.update({
        where: { id: game.id },
        data: { startsAt: new Date(Date.now() - 60 * 60 * 1000) } // 1 hour ago
      });

      // When: user marks payment
      await markPayment(game.id, user.id);

      // Then: payment should be marked
      const registration = await prisma.registration.findFirst({
        where: { gameId: game.id, userId: user.id }
      });
      expect(registration?.paymentStatus).toBe('paid');
      expect(registration?.paymentMarkedAt).toBeDefined();
    }, 10000);

    it('should reject payment marking before game starts', async () => {
      // Given: game that hasn't started yet
      const user = await prisma.user.create({
        data: { telegramId: 123456789n, name: 'Test User' }
      });
      const organizer = await prisma.organizer.create({
        data: { userId: user.id, title: 'Test Organizer' }
      });
      const game = await prisma.game.create({
        data: {
          organizerId: organizer.id,
          venueId: 'venue1',
          startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // tomorrow
          capacity: 10,
          status: GameStatus.open
        }
      });

      await joinGame(game.id, user.id);

      // When & Then: should throw error
      await expect(markPayment(game.id, user.id)).rejects.toThrow('Окно оплаты еще не открыто');
    }, 10000);
  });

  describe('createGame', () => {
    it('should create a new game successfully', async () => {
      // Given: organizer
      const user = await prisma.user.create({
        data: { telegramId: 123456789n, name: 'Test User' }
      });
      const organizer = await prisma.organizer.create({
        data: { userId: user.id, title: 'Test Organizer' }
      });

      const gameData = {
        organizerId: organizer.id,
        venueId: 'venue1',
        startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        capacity: 10,
        levelTag: 'intermediate',
        priceText: '500 руб'
      };

      // When: create game
      const game = await createGame(gameData);

      // Then: game should be created
      expect(game.id).toBeDefined();
      expect(game.organizerId).toBe(organizer.id);
      expect(game.capacity).toBe(10);
      expect(game.levelTag).toBe('intermediate');
      expect(game.priceText).toBe('500 руб');
      expect(game.status).toBe(GameStatus.open);
    }, 10000);
  });
  describe('linkPlayerToOrganizer', () => {
    it('should successfully link player to organizer', async () => {
      // Given: player and organizer
      const player = await prisma.user.create({
        data: { telegramId: 123456789n, name: 'Player User' }
      });
      const organizerUser = await prisma.user.create({
        data: { telegramId: 987654321n, name: 'Organizer User' }
      });
      const organizer = await prisma.organizer.create({
        data: { userId: organizerUser.id, title: 'Test Organizer' }
      });

      // When: link player to organizer
      const result = await linkPlayerToOrganizer(player.id, organizer.id);

      // Then: should succeed
      expect(result.ok).toBe(true);
    }, 10000);

    it('should throw error for non-existent player', async () => {
      // Given: non-existent player ID
      const fakePlayerId = 'fake-player-id';

      // When & Then: should throw error
      await expect(linkPlayerToOrganizer(fakePlayerId, 'some-organizer-id')).rejects.toThrow('Игрок не найден');
    }, 10000);

    it('should throw error for non-existent organizer', async () => {
      // Given: existing player but non-existent organizer
      const player = await prisma.user.create({
        data: { telegramId: 123456789n, name: 'Player User' }
      });
      const fakeOrganizerId = 'fake-organizer-id';

      // When & Then: should throw error
      await expect(linkPlayerToOrganizer(player.id, fakeOrganizerId)).rejects.toThrow('Организатор не найден');
    }, 10000);
  });
});