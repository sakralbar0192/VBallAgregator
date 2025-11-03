import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { prisma } from '../infrastructure/prisma.js';
import { registerUser, registerOrganizer, createGame, joinGame, markPayment } from '../application/use-cases.js';
import { GameStatus } from '../domain/game.js';

describe('Integration Tests - Full User Journey', () => {
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

  it('should complete full registration and game participation flow', async () => {
    // Step 1: Register organizer
    const organizerResult = await registerUser(123456789, 'John Organizer');
    expect(organizerResult.userId).toBeDefined();

    const organizer = await registerOrganizer(organizerResult.userId, 'Beach Volleyball Club');
    expect(organizer.ok).toBe(true);

    // Get organizer record for game creation
    const organizerRecord = await prisma.organizer.findUnique({
      where: { userId: organizerResult.userId }
    });
    expect(organizerRecord).toBeDefined();

    // Step 2: Register player
    const playerResult = await registerUser(987654321, 'Jane Player');
    expect(playerResult.userId).toBeDefined();

    // Step 3: Organizer creates game
    const gameData = {
      organizerId: organizerRecord!.id,
      venueId: 'venue-beach-1',
      startsAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
      capacity: 12,
      levelTag: 'intermediate',
      priceText: '500₽'
    };

    const game = await createGame(gameData);
    expect(game.id).toBeDefined();
    expect(game.status).toBe(GameStatus.open);

    // Step 4: Player joins game
    const joinResult = await joinGame(game.id, playerResult.userId);
    expect(joinResult.status).toBe('confirmed');

    // Step 5: Verify registration in database
    const registration = await prisma.registration.findFirst({
      where: { gameId: game.id, userId: playerResult.userId }
    });
    expect(registration?.status).toBe('confirmed');
    expect(registration?.paymentStatus).toBe('unpaid');

    // Step 6: Simulate game start and mark payment
    // Update game to have started
    await prisma.game.update({
      where: { id: game.id },
      data: { startsAt: new Date(Date.now() - 60 * 60 * 1000) } // 1 hour ago
    });

    // Mark payment
    const paymentResult = await markPayment(game.id, playerResult.userId);
    expect(paymentResult.ok).toBe(true);

    // Step 7: Verify payment marked
    const updatedRegistration = await prisma.registration.findFirst({
      where: { gameId: game.id, userId: playerResult.userId }
    });
    expect(updatedRegistration?.paymentStatus).toBe('paid');
    expect(updatedRegistration?.paymentMarkedAt).toBeDefined();
  });

  it('should handle waitlist promotion when confirmed player leaves', async () => {
    // Step 1: Setup organizer and players
    const organizerResult = await registerUser(111111111, 'Organizer');
    const organizerReg = await registerOrganizer(organizerResult.userId, 'Club');
    expect(organizerReg.ok).toBe(true);

    const organizerRecord = await prisma.organizer.findUnique({
      where: { userId: organizerResult.userId }
    });
    expect(organizerRecord).toBeDefined();

    const player1Result = await registerUser(222222222, 'Player 1');
    const player2Result = await registerUser(333333333, 'Player 2');

    // Step 2: Create game with capacity 1
    const game = await createGame({
      organizerId: organizerRecord!.id,
      venueId: 'venue-1',
      startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      capacity: 1,
      levelTag: 'beginner'
    });

    // Step 3: First player joins (confirmed)
    await joinGame(game.id, player1Result.userId);

    // Step 4: Second player joins (waitlisted)
    const joinResult2 = await joinGame(game.id, player2Result.userId);
    expect(joinResult2.status).toBe('waitlisted');

    // Step 5: First player leaves, second should be promoted
    const { leaveGame } = await import('../application/use-cases.js');
    await leaveGame(game.id, player1Result.userId);

    // Step 6: Verify promotion
    const promotedReg = await prisma.registration.findFirst({
      where: { gameId: game.id, userId: player2Result.userId }
    });
    expect(promotedReg?.status).toBe('confirmed');
  });

  it('should prevent payment marking before game starts', async () => {
    // Step 1: Setup
    const organizerResult = await registerUser(444444444, 'Organizer');
    const organizerReg = await registerOrganizer(organizerResult.userId, 'Club');
    expect(organizerReg.ok).toBe(true);

    const organizerRecord = await prisma.organizer.findUnique({
      where: { userId: organizerResult.userId }
    });
    expect(organizerRecord).toBeDefined();

    const playerResult = await registerUser(555555555, 'Player');

    const game = await createGame({
      organizerId: organizerRecord!.id,
      venueId: 'venue-1',
      startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Future game
      capacity: 10
    });

    await joinGame(game.id, playerResult.userId);

    // Step 2: Try to mark payment before game starts
    const { markPayment } = await import('../application/use-cases.js');
    expect(async () => {
      await markPayment(game.id, playerResult.userId);
    }).toThrow('Окно оплаты еще не открыто');
  });
});