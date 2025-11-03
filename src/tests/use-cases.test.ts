import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { prisma } from '../infrastructure/prisma.js';
import { joinGame, leaveGame, markPayment, createGame } from '../application/use-cases.js';
import { GameStatus } from '../domain/game.js';
import { RegStatus } from '../domain/registration.js';

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
  });

  describe('joinGame', () => {
    it('should allow joining an open game with available capacity', async () => {
      // Given: create user and game
      const user = await prisma.user.create({
        data: { telegramId: 123456789, name: 'Test User' }
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
    });

    it('should put user in waitlist when capacity is reached', async () => {
      // Given: create game with capacity 1 and one existing registration
      const user1 = await prisma.user.create({
        data: { telegramId: 123456789, name: 'User 1' }
      });
      const user2 = await prisma.user.create({
        data: { telegramId: 987654321, name: 'User 2' }
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
    });

    it('should reject joining a game that already started', async () => {
      // Given: create game that already started
      const user = await prisma.user.create({
        data: { telegramId: 123456789, name: 'Test User' }
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
      expect(async () => {
        await joinGame(game.id, user.id);
      }).toThrow('Игра уже началась');
    });
  });

  describe('leaveGame', () => {
    it('should allow leaving a game and promote waitlisted user', async () => {
      // Given: game with confirmed user and waitlisted user
      const user1 = await prisma.user.create({
        data: { telegramId: 123456789, name: 'User 1' }
      });
      const user2 = await prisma.user.create({
        data: { telegramId: 987654321, name: 'User 2' }
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
    });
  });

  describe('markPayment', () => {
    it('should allow marking payment after game starts', async () => {
      // Given: game that already started with confirmed registration
      const user = await prisma.user.create({
        data: { telegramId: 123456789, name: 'Test User' }
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
    });

    it('should reject payment marking before game starts', async () => {
      // Given: game that hasn't started yet
      const user = await prisma.user.create({
        data: { telegramId: 123456789, name: 'Test User' }
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
      expect(async () => {
        await markPayment(game.id, user.id);
      }).toThrow('Окно оплаты еще не открыто');
    });
  });

  describe('createGame', () => {
    it('should create a new game successfully', async () => {
      // Given: organizer
      const user = await prisma.user.create({
        data: { telegramId: 123456789, name: 'Test User' }
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
    });
  });
});