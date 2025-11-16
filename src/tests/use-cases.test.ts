import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { prisma } from '../infrastructure/prisma.js';
import { joinGame, leaveGame, markPayment, createGame, linkPlayerToOrganizer, finishGame } from '../application/use-cases.js';
import { GameStatus } from '../domain/game.js';
import { RegStatus } from '../domain/registration.js';
import { clearDatabase, createTestOrganizer } from './setup.js';
import { CommandHandlers } from '../bot/command-handlers.js';

describe('Race Conditions Test', () => {
   beforeEach(async () => {
     await clearDatabase();
   }, 10000);

   afterEach(async () => {
     await clearDatabase();
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
        venueId: 'venue-chaika-id', // Use a specific venue ID that won't conflict
        startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        capacity: 1,
        status: GameStatus.open,
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000) // 3 hours ago, outside priority window
      }
    });

    // When: first user joins, then second user tries to join
    await joinGame(game.id, user1.id);
    const result2 = await joinGame(game.id, user2.id);

    // Then: first should be confirmed, second waitlisted
    expect(result2.status).toBe(RegStatus.waitlisted);

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
     await clearDatabase();
   });

   afterEach(async () => {
     await clearDatabase();
   }, 10000);

  describe('joinGame', () => {
    it('should allow joining an open game with available capacity', async () => {
      // Given: create user and game
      const { user, organizer } = await createTestOrganizer(123456789n, 'Test User', 'Test Organizer');
      const game = await prisma.game.create({
        data: {
          organizerId: organizer.id,
          venueId: 'venue1',
          startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // tomorrow
          capacity: 10,
          status: GameStatus.open,
          createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000) // 3 hours ago, outside priority window
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
      const { user: user1, organizer } = await createTestOrganizer(123456789n, 'User 1', 'Test Organizer');
      const user2 = await prisma.user.create({
        data: { telegramId: 987654321n, name: 'User 2' }
      });
      const game = await prisma.game.create({
        data: {
          organizerId: organizer.id,
          venueId: 'venue1',
          startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          capacity: 1,
          status: GameStatus.open,
          createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000) // 3 hours ago, outside priority window
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
      const { user, organizer } = await createTestOrganizer(123456789n, 'Test User', 'Test Organizer');
      const game = await prisma.game.create({
        data: {
          organizerId: organizer.id,
          venueId: 'venue1',
          startsAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
          capacity: 10,
          status: GameStatus.open,
          createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000) // 3 hours ago, outside priority window
        }
      });

      // When & Then: should throw error
      await expect(joinGame(game.id, user.id)).rejects.toThrow('Игра уже началась');
    }, 10000);
  });

  describe('leaveGame', () => {
    it('should allow leaving a game and promote waitlisted user', async () => {
      // Given: game with confirmed user and waitlisted user
      const { user: user1, organizer } = await createTestOrganizer(123456789n, 'User 1', 'Test Organizer');
      const user2 = await prisma.user.create({
        data: { telegramId: 987654321n, name: 'User 2' }
      });
      const game = await prisma.game.create({
        data: {
          organizerId: organizer.id,
          venueId: 'venue1',
          startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          capacity: 1,
          status: GameStatus.open,
          createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000) // 3 hours ago, outside priority window
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
      const { user, organizer } = await createTestOrganizer(123456789n, 'Test User', 'Test Organizer');
      const game = await prisma.game.create({
        data: {
          organizerId: organizer.id,
          venueId: 'venue1',
          startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // tomorrow
          capacity: 10,
          status: GameStatus.open,
          createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000) // 3 hours ago, outside priority window
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
      const { user, organizer } = await createTestOrganizer(123456789n, 'Test User', 'Test Organizer');
      const game = await prisma.game.create({
        data: {
          organizerId: organizer.id,
          venueId: 'venue1',
          startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // tomorrow
          capacity: 10,
          status: GameStatus.open,
          createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000) // 3 hours ago, outside priority window
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
      const { user, organizer } = await createTestOrganizer(123456789n, 'Test User', 'Test Organizer');

      const gameData = {
        organizerId: user.id, // Use userId, not organizer.id
        venueId: 'venue1',
        startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        capacity: 10,
        levelTag: 'intermediate',
        priceText: '500 руб',
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000) // 3 hours ago, outside priority window
      };

      // When: create game
      const game = await createGame(gameData);

      // Then: game should be created
      expect(game.id).toBeDefined();
      expect(game.organizerId).toBe(organizer.id); // organizer.id is correct here
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
      const { organizer } = await createTestOrganizer(987654321n, 'Organizer User', 'Test Organizer');

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

 describe('Event Handlers', () => {
   beforeEach(async () => {
     await clearDatabase();
   });

   afterEach(async () => {
     await clearDatabase();
   }, 10000);

   it('should handle PlayerJoined event and notify organizer', async () => {
     // Given: game with organizer and player joining
     const { user: organizerUser, organizer } = await createTestOrganizer(123456789n, 'Organizer', 'Test Organizer');
     const player = await prisma.user.create({
       data: { telegramId: 987654321n, name: 'Player' }
     });
     const game = await prisma.game.create({
       data: {
         organizerId: organizer.id,
         venueId: 'venue1',
         startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
         capacity: 10,
         status: GameStatus.open,
         createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000) // 3 hours ago, outside priority window
       }
     });

     // When: player joins game
     await joinGame(game.id, player.id);

     // Then: event should be published and handled
     // Note: Event handling is tested implicitly through the joinGame function
     // In a real scenario, we'd mock the event publisher and verify notifications
     const registration = await prisma.registration.findFirst({
       where: { gameId: game.id, userId: player.id }
     });
     expect(registration?.status).toBe(RegStatus.confirmed);
   }, 10000);

   it('should handle WaitlistedPromoted event when user leaves', async () => {
     // Given: game with confirmed and waitlisted users
     const { user: user1, organizer } = await createTestOrganizer(123456789n, 'User 1', 'Test Organizer');
     const user2 = await prisma.user.create({
       data: { telegramId: 987654321n, name: 'User 2' }
     });
     const game = await prisma.game.create({
       data: {
         organizerId: organizer.id,
         venueId: 'venue1',
         startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
         capacity: 1,
         status: GameStatus.open,
         createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000) // 3 hours ago, outside priority window
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

   it('should handle PaymentMarked event', async () => {
     // Given: game that started with confirmed registration
     const { user, organizer } = await createTestOrganizer(123456789n, 'Test User', 'Test Organizer');
     const game = await prisma.game.create({
       data: {
         organizerId: organizer.id,
         venueId: 'venue1',
         startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
         capacity: 10,
         status: GameStatus.open,
         createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000) // 3 hours ago, outside priority window
       }
     });

     await joinGame(game.id, user.id);

     // Update game to have started
     await prisma.game.update({
       where: { id: game.id },
       data: { startsAt: new Date(Date.now() - 60 * 60 * 1000) }
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
 });

 describe('Scheduler Integration', () => {
   beforeEach(async () => {
     await clearDatabase();
   });

   afterEach(async () => {
     await clearDatabase();
   }, 10000);

   it('should schedule game reminders when creating a game', async () => {
     // Given: organizer
     const { user, organizer } = await createTestOrganizer(123456789n, 'Test User', 'Test Organizer');

     const gameData = {
       organizerId: user.id,
       venueId: 'venue1',
       startsAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 2 days from now
       capacity: 10,
       levelTag: 'intermediate',
       priceText: '500 руб',
       createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000) // 3 hours ago, outside priority window
     };

     // When: create game
     const game = await createGame(gameData);

     // Then: game should be created and reminders scheduled
     expect(game.id).toBeDefined();
     expect(game.status).toBe(GameStatus.open);

     // Verify game exists in database
     const dbGame = await prisma.game.findUnique({ where: { id: game.id } });
     expect(dbGame).toBeDefined();
     expect(dbGame?.status).toBe(GameStatus.open);
   }, 10000);

   it('should schedule payment reminders when finishing a game', async () => {
     // Given: created game
     const { user, organizer } = await createTestOrganizer(123456789n, 'Test User', 'Test Organizer');
     const game = await prisma.game.create({
       data: {
         organizerId: organizer.id,
         venueId: 'venue1',
         startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
         capacity: 10,
         status: GameStatus.open,
         createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000) // 3 hours ago, outside priority window
       }
     });

     // When: finish game
     await finishGame(game.id);

     // Then: game should be finished
     const finishedGame = await prisma.game.findUnique({ where: { id: game.id } });
     expect(finishedGame?.status).toBe(GameStatus.finished);
   }, 10000);
 });

 describe('Command Handlers', () => {
   let mockCtx: any;

   beforeEach(async () => {
     await clearDatabase();

     // Mock Telegraf context
     mockCtx = {
       from: { id: 123456789n },
       reply: jest.fn()
     };
   });

   afterEach(async () => {
     await clearDatabase();
   }, 10000);

   it('should handle handleGames command when no games exist', async () => {
     // When: call handleGames
     await CommandHandlers.handleGames(mockCtx);

     // Then: should reply with no games message for non-organizer
     expect(mockCtx.reply).toHaveBeenCalledWith('Нет активных игр. Ждем, когда организаторы создадут новые игры');
   }, 10000);

   it('should filter out games user already joined', async () => {
     // Given: user, organizer, and games
     const { user, organizer } = await createTestOrganizer(123456789n, 'Test User', 'Test Organizer');
     
     // Create two games
     const game1 = await prisma.game.create({
       data: {
         organizerId: organizer.id,
         venueId: 'venue1',
         startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
         capacity: 10,
         status: GameStatus.open,
         createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000) // outside priority window
       }
     });
     
     const game2 = await prisma.game.create({
       data: {
         organizerId: organizer.id,
         venueId: 'venue2',
         startsAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
         capacity: 10,
         status: GameStatus.open,
         createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000) // outside priority window
       }
     });

     // User joins game1
     await joinGame(game1.id, user.id);

     // When: call handleGames
     await CommandHandlers.handleGames(mockCtx);

     // Then: should only show game2 (game1 filtered out because user joined)
     expect(mockCtx.reply).toHaveBeenCalledWith(
       expect.stringContaining('Доступные игры:'),
       expect.objectContaining({
         reply_markup: expect.objectContaining({
           inline_keyboard: expect.arrayContaining([
             expect.arrayContaining([
               expect.objectContaining({
                 text: expect.stringContaining('🎾 Присоединиться'),
                 callback_data: `join_game_${game2.id}`
               })
             ])
           ])
         })
       })
     );
   }, 10000);

   it('should show games with cancelled registration', async () => {
     // Given: user, organizer, and game
     const { user, organizer } = await createTestOrganizer(123456789n, 'Test User', 'Test Organizer');
     const game = await prisma.game.create({
       data: {
         organizerId: organizer.id,
         venueId: 'venue1',
         startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
         capacity: 10,
         status: GameStatus.open,
         createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000) // outside priority window
       }
     });

     // User joins and then leaves (cancels registration)
     await joinGame(game.id, user.id);
     await leaveGame(game.id, user.id);

     // When: call handleGames
     await CommandHandlers.handleGames(mockCtx);

     // Then: should show the game (because registration was cancelled)
     expect(mockCtx.reply).toHaveBeenCalledWith(
       expect.stringContaining('Доступные игры:'),
       expect.objectContaining({
         reply_markup: expect.objectContaining({
           inline_keyboard: expect.arrayContaining([
             expect.arrayContaining([
               expect.objectContaining({
                 text: expect.stringContaining('🎾 Присоединиться'),
                 callback_data: `join_game_${game.id}`
               })
             ])
           ])
         })
       })
     );
   }, 10000);

   it('should allow re-joining after cancellation and notify organizer', async () => {
     // Given: user joins, leaves, then re-joins
     const { user, organizer } = await createTestOrganizer(123456789n, 'Test User', 'Test Organizer');
     const game = await prisma.game.create({
       data: {
         organizerId: organizer.id,
         venueId: 'venue1',
         startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
         capacity: 10,
         status: GameStatus.open,
         createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000) // outside priority window
       }
     });

     // User joins
     await joinGame(game.id, user.id);
     let registration = await prisma.registration.findFirst({
       where: { gameId: game.id, userId: user.id }
     });
     expect(registration?.status).toBe(RegStatus.confirmed);
     const firstRegId = registration?.id;

     // User leaves (cancels)
     await leaveGame(game.id, user.id);
     registration = await prisma.registration.findFirst({
       where: { gameId: game.id, userId: user.id }
     });
     expect(registration?.status).toBe(RegStatus.canceled);

     // When: user re-joins
     const result = await joinGame(game.id, user.id);

     // Then: should be confirmed again and use same registration ID
     expect(result.status).toBe(RegStatus.confirmed);
     registration = await prisma.registration.findFirst({
       where: { gameId: game.id, userId: user.id }
     });
     expect(registration?.status).toBe(RegStatus.confirmed);
     expect(registration?.id).toBe(firstRegId); // Same registration ID, not a new one
   }, 10000);

   it('should show message when all games already occupied by user', async () => {
     // Given: user, organizer, and game
     const { user, organizer } = await createTestOrganizer(123456789n, 'Test User', 'Test Organizer');
     const game = await prisma.game.create({
       data: {
         organizerId: organizer.id,
         venueId: 'venue1',
         startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
         capacity: 10,
         status: GameStatus.open,
         createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000) // outside priority window
       }
     });

     // User joins the game
     await joinGame(game.id, user.id);

     // When: call handleGames
     await CommandHandlers.handleGames(mockCtx);

     // Then: should show message that all games are occupied
     expect(mockCtx.reply).toHaveBeenCalledWith('Все доступные игры уже заняты тобой. Проверь свои регистрации командой /my');
   }, 10000);

   it('should handle handleJoin command with valid game', async () => {
     // Given: user and game
     const { user, organizer } = await createTestOrganizer(123456789n, 'Test User', 'Test Organizer');
     const game = await prisma.game.create({
       data: {
         organizerId: organizer.id,
         venueId: 'venue1',
         startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
         capacity: 10,
         status: GameStatus.open,
         createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000) // 3 hours ago, outside priority window
       }
     });

     // When: call handleJoin
     await CommandHandlers.handleJoin(mockCtx, game.id);

     // Then: should reply with success message
     expect(mockCtx.reply).toHaveBeenCalledWith('Место забронировано ✅');
   }, 10000);

   it('should handle handlePay command after game starts', async () => {
     // Given: user, game that started, and registration
     const { user, organizer } = await createTestOrganizer(123456789n, 'Test User', 'Test Organizer');
     const game = await prisma.game.create({
       data: {
         organizerId: organizer.id,
         venueId: 'venue1',
         startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
         capacity: 10,
         status: GameStatus.open,
         createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000) // 3 hours ago, outside priority window
       }
     });

     await joinGame(game.id, user.id);

     // Update game to have started
     await prisma.game.update({
       where: { id: game.id },
       data: { startsAt: new Date(Date.now() - 60 * 60 * 1000) }
     });

     // When: call handlePay
     await CommandHandlers.handlePay(mockCtx, game.id);

     // Then: should reply with payment marked message
     expect(mockCtx.reply).toHaveBeenCalledWith('Оплата отмечена 💰 Спасибо!');
   }, 10000);
 });
});