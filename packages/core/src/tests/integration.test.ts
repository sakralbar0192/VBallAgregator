import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { prisma } from '../infrastructure/prisma.js';
import { registerUser, registerOrganizer, createGame, joinGame, markPayment, setUserDemographics, upsertUserSportProfileRow, setUserVolleyballOnboardingSummary } from '../application/use-cases.js';
import { GameStatus } from '../domain/game.js';
import { RegStatus } from '../domain/registration.js';
import { clearDatabase } from './test-db-helpers.js';

describe('Integration Tests - Full User Journey', () => {
   beforeEach(async () => {
     await clearDatabase();
   }, 10000);

   afterEach(async () => {
     await clearDatabase();
   }, 10000);

  it('should complete full registration and game participation flow', async () => {
    // Step 1: Register organizer
    const organizerResult = await registerUser(123456789n, 'John Organizer');
    expect(organizerResult.userId).toBeDefined();

    const organizer = await registerOrganizer(organizerResult.userId, 'Beach Volleyball Club');
    expect(organizer.ok).toBe(true);

    // Get organizer record for game creation
    const organizerRecord = await prisma.organizer.findUnique({
      where: { userId: organizerResult.userId }
    });
    expect(organizerRecord).toBeDefined();

    // Step 2: Register player
    const playerResult = await registerUser(987654321n, 'Jane Player');
    expect(playerResult.userId).toBeDefined();

    // Step 3: Organizer creates game
    const gameData = {
      organizerId: organizerResult.userId, // Use userId, not organizer.id
      venueId: 'venue-beach-1',
      startsAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
      capacity: 12,
      levelTag: 'intermediate',
      priceText: '500₽'
    };

    const game = await createGame(gameData);
    expect(game.id).toBeDefined();
    expect(game.status).toBe(GameStatus.open);

    // Update createdAt to be outside priority window
    await prisma.game.update({
      where: { id: game.id },
      data: { createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000) }
    });

    // Step 4: Player joins game
    const joinResult = await joinGame(game.id, playerResult.userId);
    expect(joinResult.status).toBe(RegStatus.confirmed);

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
    const organizerResult = await registerUser(111111111n, 'Organizer');
    const organizerReg = await registerOrganizer(organizerResult.userId, 'Club');
    expect(organizerReg.ok).toBe(true);

    const organizerRecord = await prisma.organizer.findUnique({
      where: { userId: organizerResult.userId }
    });
    expect(organizerRecord).toBeDefined();

    const player1Result = await registerUser(222222222n, 'Player 1');
    const player2Result = await registerUser(333333333n, 'Player 2');

    // Step 2: Create game with capacity 1
    const game = await createGame({
      organizerId: organizerResult.userId, // Use userId, not organizer.id
      venueId: 'venue-1',
      startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      capacity: 1,
      levelTag: 'beginner'
    });

    // Update createdAt to be outside priority window
    await prisma.game.update({
      where: { id: game.id },
      data: { createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000) }
    });

    // Step 3: First player joins (confirmed)
    await joinGame(game.id, player1Result.userId);

    // Step 4: Second player joins (waitlisted)
    const joinResult2 = await joinGame(game.id, player2Result.userId);
    expect(joinResult2.status).toBe(RegStatus.waitlisted);

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
    const organizerResult = await registerUser(444444444n, 'Organizer');
    const organizerReg = await registerOrganizer(organizerResult.userId, 'Club');
    expect(organizerReg.ok).toBe(true);

    const organizerRecord = await prisma.organizer.findUnique({
      where: { userId: organizerResult.userId }
    });
    expect(organizerRecord).toBeDefined();

    const playerResult = await registerUser(555555555n, 'Player');

    const game = await createGame({
      organizerId: organizerResult.userId, // Use userId, not organizer.id
      venueId: 'venue-1',
      startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Future game
      capacity: 10
    });

    // Update createdAt to be outside priority window
    await prisma.game.update({
      where: { id: game.id },
      data: { createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000) }
    });

    await joinGame(game.id, playerResult.userId);

    // Step 2: Try to mark payment before game starts
    const { markPayment } = await import('../application/use-cases.js');
    await expect(markPayment(game.id, playerResult.userId)).rejects.toThrow('Окно оплаты еще не открыто');
  });
});

describe('Integration: user demographics and sport profiles', () => {
  beforeEach(async () => {
    await clearDatabase();
  }, 10000);

  afterEach(async () => {
    await clearDatabase();
  }, 10000);

  it('persists demographics, volleyball sport profile and level summary', async () => {
    const { userId } = await registerUser(600000001n, 'Multi');
    await setUserDemographics(userId, { gender: 'men' });
    await setUserDemographics(userId, { ageBand: 'after-thirty' });
    await upsertUserSportProfileRow(userId, 'volleyball', {
      volleyballSkillTag: 'intermediate',
      volleyballFormats: 'classic',
      wantsOrganizeVolleyball: true,
    });
    await setUserVolleyballOnboardingSummary(userId, 'intermediate');

    const u = await prisma.user.findUnique({ where: { id: userId } });
    expect(u?.gender).toBe('men');
    expect(u?.ageBand).toBe('after-thirty');
    expect(u?.levelTag).toBe('intermediate');
    expect(u?.activeSport).toBe('volleyball');

    const sp = await prisma.userSportProfile.findUnique({
      where: { userId_sport: { userId, sport: 'volleyball' } },
    });
    expect(sp?.volleyballSkillTag).toBe('intermediate');
    expect(sp?.wantsOrganizeVolleyball).toBe(true);
  });

  it('creates tennis user sport profile marker', async () => {
    const { userId } = await registerUser(600000002n, 'Ten');
    await setUserDemographics(userId, { gender: 'women', ageBand: 'before-twenty' });
    await upsertUserSportProfileRow(userId, 'tennis');
    const sp = await prisma.userSportProfile.findUnique({
      where: { userId_sport: { userId, sport: 'tennis' } },
    });
    expect(sp?.sport).toBe('tennis');
  });

  it('persists volleyball and tennis sport rows with organizer only when requested', async () => {
    const { userId } = await registerUser(600000003n, 'Both');
    await setUserDemographics(userId, { gender: 'men', ageBand: 'after-thirty' });
    await upsertUserSportProfileRow(userId, 'volleyball', {
      volleyballSkillTag: 'novice',
      volleyballFormats: 'classic',
      wantsOrganizeVolleyball: true,
    });
    await upsertUserSportProfileRow(userId, 'tennis');
    await setUserVolleyballOnboardingSummary(userId, 'novice');

    const org = await prisma.organizer.findUnique({ where: { userId } });
    expect(org).toBeNull();

    const vb = await prisma.userSportProfile.findUnique({
      where: { userId_sport: { userId, sport: 'volleyball' } },
    });
    const tn = await prisma.userSportProfile.findUnique({
      where: { userId_sport: { userId, sport: 'tennis' } },
    });
    expect(vb?.wantsOrganizeVolleyball).toBe(true);
    expect(tn?.sport).toBe('tennis');
  });
});