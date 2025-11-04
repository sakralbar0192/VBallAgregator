import { EventBus, DomainEvent } from '../shared/event-bus.js';
import { NotificationService } from '../shared/notification-service.js';
import { config } from '../shared/config.js';
import { prisma } from './prisma.js';
import { formatGameTimeForNotification, getUserTimezone } from '../shared/date-utils.js';
import { logger } from '../shared/logger.js';
import { DomainEvent as TypedDomainEvent } from '../shared/types.js';

const notificationService = new NotificationService(config.telegram.botToken);

export async function setupEventHandlers(eventBus: EventBus): Promise<void> {
  // Game reminder handlers
  eventBus.subscribe('GameReminder24h', { handle: handleGameReminder24h });
  eventBus.subscribe('GameReminder2h', { handle: handleGameReminder2h });

  // Payment reminder handlers
  eventBus.subscribe('PaymentReminder12h', { handle: handlePaymentReminder12h });
  eventBus.subscribe('PaymentReminder24h', { handle: handlePaymentReminder24h });

  // Player events
  eventBus.subscribe('PlayerJoined', { handle: handlePlayerJoined });
  eventBus.subscribe('WaitlistedPromoted', { handle: handleWaitlistedPromoted });
  eventBus.subscribe('PaymentMarked', { handle: handlePaymentMarked });

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
      message: `⏰ Напоминание: игра завтра в ${formatGameTimeForNotification(game.startsAt, getUserTimezone(reg.userId))}!\n🏟️ ${game.levelTag || 'Общий уровень'}\n💰 ${game.priceText || 'Бесплатно'}`,
      type: 'game-reminder-24h'
    }));

  try {
    await notificationService.sendBatch(notifications);
    logger.info('Game reminder notifications sent', { gameId, count: notifications.length });
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
      message: `🚨 Через 2 часа игра!\n⏰ ${formatGameTimeForNotification(game.startsAt, getUserTimezone(reg.userId))}\n🏟️ ${game.levelTag || 'Общий уровень'}\n💰 ${game.priceText || 'Бесплатно'}`,
      type: 'game-reminder-2h'
    }));

  try {
    await notificationService.sendBatch(notifications);
    logger.info('Game 2h reminder notifications sent', { gameId, count: notifications.length });
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

  const notifications = game.registrations
    .filter(reg => reg.user.telegramId)
    .map(reg => ({
      userId: reg.userId,
      chatId: reg.user.telegramId!,
      message: `💰 Напоминание: оплата за игру "${game.levelTag || 'Волейбол'}"\nОрганизатор: ${game.organizerId}\n💳 Пожалуйста, произведите оплату`,
      type: 'payment-reminder-12h'
    }));

  try {
    await notificationService.sendBatch(notifications);
    logger.info('Payment reminder 12h notifications sent', { gameId, count: notifications.length });
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

  const notifications = game.registrations
    .filter(reg => reg.user.telegramId)
    .map(reg => ({
      userId: reg.userId,
      chatId: reg.user.telegramId!,
      message: `⚠️ Последнее напоминание об оплате!\n💰 Игра "${game.levelTag || 'Волейбол'}"\nОрганизатор: ${game.organizerId}\n⏰ Просьба оплатить в ближайшее время`,
      type: 'payment-reminder-24h'
    }));

  try {
    await notificationService.sendBatch(notifications);
    logger.info('Payment reminder 24h notifications sent', { gameId, count: notifications.length });
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
    await notificationService.sendMessage(game.organizer.user.telegramId, message, 'player-joined');
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
    await notificationService.sendMessage(registration.user.telegramId, message, 'waitlist-promoted');
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
    await notificationService.sendMessage(game.organizer.user.telegramId, message, 'payment-marked');
    logger.info('Payment marked notification sent to organizer', { gameId, userId, organizerId: game.organizer.user.telegramId });
  } catch (error) {
    logger.error('Failed to send payment marked notification', { gameId, userId, error: error instanceof Error ? error.message : 'Unknown error' });
  }
}