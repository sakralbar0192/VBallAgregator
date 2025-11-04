import { EventBus } from './event-bus.js';
import { EnhancedNotificationService } from './enhanced-notification-service.js';
import { config } from './config.js';
import { prisma } from '../infrastructure/prisma.js';
import { formatGameTimeForNotification, getUserTimezone } from './date-utils.js';
import { logger } from './logger.js';
import { DomainEvent as TypedDomainEvent } from './types.js';
import { getOrganizerName, getVenueName } from './game-constants.js';

const notificationService = new EnhancedNotificationService(config.telegram.botToken);

export async function registerEventHandlers(eventBus: EventBus): Promise<void> {
  // Game reminder handlers
  eventBus.subscribe('GameReminder24h', { handle: handleGameReminder24h });
  eventBus.subscribe('GameReminder2h', { handle: handleGameReminder2h });
  eventBus.subscribe('GameCreated', { handle: handleGameCreated });

  // Payment reminder handlers
  eventBus.subscribe('PaymentReminder12h', { handle: handlePaymentReminder12h });
  eventBus.subscribe('PaymentReminder24h', { handle: handlePaymentReminder24h });
  eventBus.subscribe('SendPaymentReminders', { handle: handleSendPaymentReminders });

  // Player events
  eventBus.subscribe('PlayerJoined', { handle: handlePlayerJoined });
  eventBus.subscribe('WaitlistedPromoted', { handle: handleWaitlistedPromoted });
  eventBus.subscribe('PaymentMarked', { handle: handlePaymentMarked });

  // Additional events
  eventBus.subscribe('RegistrationCanceled', { handle: handleRegistrationCanceled });
  eventBus.subscribe('GameClosed', { handle: handleGameClosed });
  eventBus.subscribe('PlayerLinkedToOrganizer', { handle: handlePlayerLinkedToOrganizer });
  eventBus.subscribe('PaymentAttemptRejectedEarly', { handle: handlePaymentAttemptRejectedEarly });

  logger.info('Event handlers setup completed');
}

// Кеш для данных пользователей (telegramId -> user data)
const userCache = new Map<bigint, { id: string; name: string; telegramId: bigint }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 минут

async function getUserData(telegramId: bigint) {
  const cached = userCache.get(telegramId);
  if (cached) return cached;

  const user = await prisma.user.findUnique({ where: { telegramId } });
  if (user) {
    userCache.set(telegramId, user);
    // Очистка кеша через TTL
    setTimeout(() => userCache.delete(telegramId), CACHE_TTL);
    return user;
  }
  return null;
}

async function handleGameReminder24h(event: TypedDomainEvent) {
  if (event.type !== 'GameReminder24h') return;
  const { gameId } = event.payload;
  logger.info('Processing GameReminder24h', { gameId });

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      registrations: {
        where: { status: 'confirmed' },
        include: { user: true }
      }
    }
  });

  if (!game) {
    logger.warn('Game not found for reminder', { gameId });
    return;
  }

  const notifications = game.registrations
    .filter(reg => reg.user.telegramId)
    .map(reg => ({
      userId: reg.userId,
      chatId: reg.user.telegramId!,
      message: `⏰ Напоминание: игра завтра ${formatGameTimeForNotification(game.startsAt, getUserTimezone(reg.userId))}!\n🏟️ ${getVenueName(game.venueId) || ''}\n💰 ${game.priceText || 'Бесплатно'}`,
      type: 'game-reminder-24h',
      gameId
    }));

  try {
    const result = await notificationService.sendBatch(notifications);
    logger.info('Game reminder notifications sent', {
      gameId,
      total: notifications.length,
      successful: result.successful,
      failed: result.failed
    });
  } catch (error) {
    logger.error('Failed to send game reminder notifications', { gameId, error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

async function handleGameReminder2h(event: TypedDomainEvent) {
  if (event.type !== 'GameReminder2h') return;
  const { gameId } = event.payload;
  logger.info('Processing GameReminder2h', { gameId });

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      registrations: {
        where: { status: 'confirmed' },
        include: { user: true }
      }
    }
  });

  if (!game) {
    logger.warn('Game not found for 2h reminder', { gameId });
    return;
  }

  const notifications = game.registrations
    .filter(reg => reg.user.telegramId)
    .map(reg => ({
      userId: reg.userId,
      chatId: reg.user.telegramId!,
      message: `🚨 Через 2 часа игра!\n⏰ ${formatGameTimeForNotification(game.startsAt, getUserTimezone(reg.userId))}\n🏟️ ${getVenueName(game.venueId) || ''}\n💰 ${game.priceText || 'Бесплатно'}`,
      type: 'game-reminder-2h',
      gameId
    }));

  try {
    const result = await notificationService.sendBatch(notifications);
    logger.info('Game 2h reminder notifications sent', {
      gameId,
      total: notifications.length,
      successful: result.successful,
      failed: result.failed
    });
  } catch (error) {
    logger.error('Failed to send game 2h reminder notifications', { gameId, error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

async function handlePaymentReminder12h(event: TypedDomainEvent) {
  if (event.type !== 'PaymentReminder12h') return;
  const { gameId } = event.payload;
  logger.info('Processing PaymentReminder12h', { gameId });

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      registrations: {
        where: { status: 'confirmed', paymentStatus: 'unpaid' },
        include: { user: true }
      }
    }
  });

  if (!game) {
    logger.warn('Game not found for payment reminder 12h', { gameId });
    return;
  }

  // Дополнительная проверка: отправляем только если окно оплаты открыто
  if (new Date() < game.startsAt) {
    logger.info('Payment window not open yet, skipping reminder', { gameId, startsAt: game.startsAt });
    return;
  }

  const notifications = game.registrations
    .filter(reg => reg.user.telegramId)
    .map(reg => ({
      userId: reg.userId,
      chatId: reg.user.telegramId!,
      message: `💰 Напоминание: оплата за игру ${game.id || ''}\n${getOrganizerName(game)}💳 Пожалуйста, произведите оплату`,
      type: 'payment-reminder-12h',
      gameId
    }));

  try {
    const result = await notificationService.sendBatch(notifications);
    logger.info('Payment reminder 12h notifications sent', {
      gameId,
      total: notifications.length,
      successful: result.successful,
      failed: result.failed
    });
  } catch (error) {
    logger.error('Failed to send payment reminder 12h notifications', { gameId, error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

async function handlePaymentReminder24h(event: TypedDomainEvent) {
  if (event.type !== 'PaymentReminder24h') return;
  const { gameId } = event.payload;
  logger.info('Processing PaymentReminder24h', { gameId });

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      registrations: {
        where: { status: 'confirmed', paymentStatus: 'unpaid' },
        include: { user: true }
      }
    }
  });

  if (!game) {
    logger.warn('Game not found for payment reminder 24h', { gameId });
    return;
  }

  // Дополнительная проверка: отправляем только если окно оплаты открыто
  if (new Date() < game.startsAt) {
    logger.info('Payment window not open yet, skipping reminder', { gameId, startsAt: game.startsAt });
    return;
  }

  const notifications = game.registrations
    .filter(reg => reg.user.telegramId)
    .map(reg => ({
      userId: reg.userId,
      chatId: reg.user.telegramId!,
      message: `⚠️ Последнее напоминание об оплате!\n💰 Игра ${game.id || ''}\n${getOrganizerName(game)}⏰ Просьба оплатить в ближайшее время`,
      type: 'payment-reminder-24h',
      gameId
    }));

  try {
    const result = await notificationService.sendBatch(notifications);
    logger.info('Payment reminder 24h notifications sent', {
      gameId,
      total: notifications.length,
      successful: result.successful,
      failed: result.failed
    });
  } catch (error) {
    logger.error('Failed to send payment reminder 24h notifications', { gameId, error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

async function handlePlayerJoined(event: TypedDomainEvent) {
  if (event.type !== 'PlayerJoined') return;
  const { gameId, userId, status } = event.payload;
  logger.info('Processing PlayerJoined', { gameId, userId, status });

  // Уведомить организатора
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { organizer: { include: { user: true } } }
  });

  if (!game?.organizer?.user?.telegramId) {
    logger.warn('Organizer not found for player joined notification', { gameId, userId });
    return;
  }

  const user = await getUserData(game.organizer.user.telegramId);
  if (!user) {
    logger.warn('User data not found for organizer', { gameId, userId, organizerTelegramId: game.organizer.user.telegramId });
    return;
  }

  const statusText = status === 'confirmed' ? '✅ Подтвержден' : '⏳ В листе ожидания';
  const message = `👤 Новый участник в игре!\n${user.name} - ${statusText}`;

  try {
    await notificationService.sendNotification({
      userId: game.organizer.user.id,
      chatId: game.organizer.user.telegramId,
      message,
      type: 'player-joined',
      gameId
    });
    logger.info('Player joined notification sent to organizer', { gameId, userId, organizerId: game.organizer.user.telegramId });
  } catch (error) {
    logger.error('Failed to send player joined notification', { gameId, userId, error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

async function handleWaitlistedPromoted(event: TypedDomainEvent) {
  if (event.type !== 'WaitlistedPromoted') return;
  const { gameId, userId } = event.payload;
  logger.info('Processing WaitlistedPromoted', { gameId, userId });

  // Найти пользователя и уведомить
  const registration = await prisma.registration.findFirst({
    where: { gameId, userId },
    include: { user: true, game: true }
  });

  if (!registration?.user?.telegramId) {
    logger.warn('User not found for waitlist promotion notification', { gameId, userId });
    return;
  }

  const userTz = getUserTimezone(registration.userId);
  const gameTime = formatGameTimeForNotification(registration.game.startsAt, userTz);
  const message = `🎉 Поздравляем! Вы продвинуты из листа ожидания!\n✅ Место подтверждено на игру ${gameTime}\n💰 Не забудьте оплатить участие`;

  try {
    await notificationService.sendNotification({
      userId: registration.userId,
      chatId: registration.user.telegramId,
      message,
      type: 'waitlist-promoted',
      gameId
    });
    logger.info('Waitlist promotion notification sent', { gameId, userId, userTelegramId: registration.user.telegramId });
  } catch (error) {
    logger.error('Failed to send waitlist promotion notification', { gameId, userId, error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

async function handlePaymentMarked(event: TypedDomainEvent) {
  if (event.type !== 'PaymentMarked') return;
  const { gameId, userId } = event.payload;
  logger.info('Processing PaymentMarked', { gameId, userId });

  // Уведомить организатора
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { organizer: { include: { user: true } } }
  });

  if (!game?.organizer?.user?.telegramId) {
    logger.warn('Organizer not found for payment marked notification', { gameId, userId });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    logger.warn('User not found for payment marked notification', { gameId, userId });
    return;
  }

  const message = `💰 Оплата получена!\n👤 ${user.name} отметил оплату за игру`;

  try {
    await notificationService.sendNotification({
      userId: game.organizer.user.id,
      chatId: game.organizer.user.telegramId,
      message,
      type: 'payment-marked',
      gameId
    });
    logger.info('Payment marked notification sent to organizer', { gameId, userId, organizerId: game.organizer.user.telegramId });
  } catch (error) {
    logger.error('Failed to send payment marked notification', { gameId, userId, error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

async function handleGameCreated(event: TypedDomainEvent) {
  if (event.type !== 'GameCreated') return;
  const { gameId } = event.payload;
  logger.info('Processing GameCreated', { gameId });

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      organizer: { include: { user: true } }
    }
  });

  if (!game) {
    logger.warn('Game not found for new game notifications', { gameId });
    return;
  }

  // Найти подходящих игроков: активные пользователи, которые не являются организатором этой игры
  const suitableUsers = await prisma.user.findMany({
    where: {
      id: { not: game.organizer.userId } // Исключаем организатора
    },
    include: {
      notificationPreferences: true
    }
  });

  // Фильтруем пользователей без Telegram ID на уровне приложения
  const filteredUsers = suitableUsers.filter(user => user.telegramId !== null);

  const message = `🎾 Новая игра!\n${formatGameTimeForNotification(game.startsAt)}\n🏟️ ${game.levelTag || 'Общий уровень'}\n💰 ${game.priceText || 'По согласованию с организатором'}\n${getOrganizerName(game)}\nПрисоединиться: /join ${gameId}`;

  const notifications = filteredUsers
    .filter(user => {
      // Проверяем настройки уведомлений
      const prefs = (user as any).notificationPreferences;
      return prefs?.globalNotifications !== false;
    })
    .map(user => ({
      userId: user.id,
      chatId: user.telegramId!,
      message,
      type: 'new-game-notification',
      gameId
    }));

  try {
    const result = await notificationService.sendBatch(notifications);
    logger.info('New game notifications sent', {
      gameId,
      total: notifications.length,
      successful: result.successful,
      failed: result.failed
    });
  } catch (error) {
    logger.error('Failed to send new game notifications', { gameId, error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

async function handleSendPaymentReminders(event: TypedDomainEvent) {
  console.log('handleSendPaymentReminders')
  if (event.type !== 'SendPaymentReminders') return;
  const { gameId, unpaidRegistrations } = event.payload;
  logger.info('Processing SendPaymentReminders', { gameId, count: unpaidRegistrations.length });

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { organizer: { include: { user: true } } }
  });
  if (!game) {
    logger.warn('Game not found for payment reminders', { gameId });
    return;
  }
  
  const message = `💰 Напоминание об оплате!\nИгра "${game.levelTag || 'Волейбол'}" завершена\n${getOrganizerName(game)}⏰ Пожалуйста, отметьте оплату командой /pay ${gameId}`;

  const notifications = unpaidRegistrations
    .filter(reg => reg.telegramId)
    .map(reg => ({
      userId: reg.userId,
      chatId: reg.telegramId!,
      message,
      type: 'manual-payment-reminder',
      gameId
    }));

  try {
    const result = await notificationService.sendBatch(notifications);
    logger.info('Manual payment reminders sent', {
      gameId,
      total: notifications.length,
      successful: result.successful,
      failed: result.failed
    });
  } catch (error) {
    logger.error('Failed to send manual payment reminders', { gameId, error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

async function handleRegistrationCanceled(event: TypedDomainEvent) {
  if (event.type !== 'RegistrationCanceled') return;
  // Обработчик для отмены регистрации - пока пустой, можно добавить логику позже
  logger.info('Processing RegistrationCanceled', { gameId: event.payload.gameId, userId: event.payload.userId });
}

async function handleGameClosed(event: TypedDomainEvent) {
  if (event.type !== 'GameClosed') return;
  // Обработчик для закрытия игры - пока пустой, можно добавить логику позже
  logger.info('Processing GameClosed', { gameId: event.payload.gameId });
}

async function handlePlayerLinkedToOrganizer(event: TypedDomainEvent) {
  if (event.type !== 'PlayerLinkedToOrganizer') return;
  // Обработчик для связи игрока с организатором - пока пустой, можно добавить логику позже
  logger.info('Processing PlayerLinkedToOrganizer', {
    playerId: event.payload.playerId,
    organizerId: event.payload.organizerId,
    playerName: event.payload.playerName
  });
}

async function handlePaymentAttemptRejectedEarly(event: TypedDomainEvent) {
  if (event.type !== 'PaymentAttemptRejectedEarly') return;
  // Обработчик для ранней попытки оплаты - пока пустой, можно добавить логику позже
  logger.info('Processing PaymentAttemptRejectedEarly', { gameId: event.payload.gameId, userId: event.payload.userId });
}