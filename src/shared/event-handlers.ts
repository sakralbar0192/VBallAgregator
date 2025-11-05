import { EventBus } from './event-bus.js';
import { EnhancedNotificationService } from './enhanced-notification-service.js';
import { config } from './config.js';
import { prisma } from '../infrastructure/prisma.js';
import { formatGameTimeForNotification, getUserTimezone } from './date-utils.js';
import { LoggerFactory } from './layer-logger.js';
import { LOG_MESSAGES } from './logging-messages.js';
import { DomainEvent as TypedDomainEvent } from './types.js';
import { getOrganizerName, getVenueName } from './game-constants.js';

const notificationService = new EnhancedNotificationService(config.telegram.botToken);
const eventLogger = LoggerFactory.external('event-handlers');

export async function registerEventHandlers(eventBus: EventBus): Promise<void> {
  // Game reminder handlers
  eventBus.subscribe('GameReminder24h', { handle: handleGameReminder24h });
  eventBus.subscribe('GameReminder2h', { handle: handleGameReminder2h });

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

  // Player-Organizer relationship events
  eventBus.subscribe('PlayerSelectedOrganizers', { handle: handlePlayerSelectedOrganizers });
  eventBus.subscribe('PlayerConfirmedByOrganizer', { handle: handlePlayerConfirmedByOrganizer });
  eventBus.subscribe('PlayerRejectedByOrganizer', { handle: handlePlayerRejectedByOrganizer });
  eventBus.subscribe('GameCreatedWithPriorityWindow', { handle: handleGameCreatedWithPriorityWindow });
  eventBus.subscribe('PlayerRespondedToGameInvitation', { handle: handlePlayerRespondedToGameInvitation });
  eventBus.subscribe('GamePublishedForAll', { handle: handleGamePublishedForAll });

  eventLogger.info('registerEventHandlers', LOG_MESSAGES.EVENT_HANDLERS.SETUP_COMPLETED);
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
  eventLogger.info('handleGameReminder24h', LOG_MESSAGES.EVENT_HANDLERS.GAME_REMINDER_24H_PROCESSING, { gameId }, { gameId });

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
    eventLogger.warn('handleGameReminder24h', LOG_MESSAGES.EVENT_HANDLERS.GAME_REMINDER_24H_NOT_FOUND, { gameId }, { gameId });
    return;
  }

  const notifications = game.registrations
    .filter(reg => reg.user.telegramId)
    .map(reg => ({
      userId: reg.userId,
      chatId: reg.user.telegramId!,
      message: `⏰ Напоминание: игра завтра ${
        formatGameTimeForNotification(game.startsAt, getUserTimezone(reg.userId))
      }!\n${
        getVenueName(game.venueId) || ''
      }\n💰 ${
        game.priceText || 'Бесплатно'
      }`,
      type: 'game-reminder-24h',
      gameId
    }));

  try {
    const result = await notificationService.sendBatch(notifications);
    eventLogger.info('handleGameReminder24h', LOG_MESSAGES.EVENT_HANDLERS.GAME_REMINDER_24H_SENT, {
      gameId,
      total: notifications.length,
      successful: result.successful,
      failed: result.failed
    }, { gameId });
  } catch (error) {
    eventLogger.error('handleGameReminder24h', LOG_MESSAGES.EVENT_HANDLERS.GAME_REMINDER_24H_FAILED, error as Error, { gameId }, { gameId });
  }
}

async function handleGameReminder2h(event: TypedDomainEvent) {
  if (event.type !== 'GameReminder2h') return;
  const { gameId } = event.payload;
  eventLogger.info('handleGameReminder2h', LOG_MESSAGES.EVENT_HANDLERS.GAME_REMINDER_2H_PROCESSING, { gameId }, { gameId });

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
    eventLogger.warn('handleGameReminder2h', LOG_MESSAGES.EVENT_HANDLERS.GAME_REMINDER_2H_NOT_FOUND, { gameId }, { gameId });
    return;
  }

  const notifications = game.registrations
    .filter(reg => reg.user.telegramId)
    .map(reg => ({
      userId: reg.userId,
      chatId: reg.user.telegramId!,
      message: `🚨 Через 2 часа игра!\n⏰ ${
        formatGameTimeForNotification(game.startsAt, getUserTimezone(reg.userId))
      }\n${
        getVenueName(game.venueId) || ''
      }\n💰 ${
        game.priceText || 'Бесплатно'
      }`,
      type: 'game-reminder-2h',
      gameId
    }));

  try {
    const result = await notificationService.sendBatch(notifications);
    eventLogger.info('handleGameReminder2h', LOG_MESSAGES.EVENT_HANDLERS.GAME_REMINDER_2H_SENT, {
      gameId,
      total: notifications.length,
      successful: result.successful,
      failed: result.failed
    }, { gameId });
  } catch (error) {
    eventLogger.error('handleGameReminder2h', LOG_MESSAGES.EVENT_HANDLERS.GAME_REMINDER_2H_FAILED, error as Error, { gameId }, { gameId });
  }
}

async function handlePaymentReminder12h(event: TypedDomainEvent) {
  if (event.type !== 'PaymentReminder12h') return;
  const { gameId } = event.payload;
  eventLogger.info('handlePaymentReminder12h', LOG_MESSAGES.EVENT_HANDLERS.PAYMENT_REMINDER_12H_PROCESSING, { gameId }, { gameId });

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
    eventLogger.warn('handlePaymentReminder12h', LOG_MESSAGES.EVENT_HANDLERS.PAYMENT_REMINDER_12H_NOT_FOUND, { gameId }, { gameId });
    return;
  }

  // Дополнительная проверка: отправляем только если окно оплаты открыто
  if (new Date() < game.startsAt) {
    eventLogger.info('handlePaymentReminder24h', LOG_MESSAGES.EVENT_HANDLERS.PAYMENT_REMINDER_24H_WINDOW_NOT_OPEN, { gameId, startsAt: game.startsAt }, { gameId });
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
    eventLogger.info('handlePaymentReminder12h', LOG_MESSAGES.EVENT_HANDLERS.PAYMENT_REMINDER_12H_SENT, {
      gameId,
      total: notifications.length,
      successful: result.successful,
      failed: result.failed
    }, { gameId });
  } catch (error) {
    eventLogger.error('handlePaymentReminder12h', LOG_MESSAGES.EVENT_HANDLERS.PAYMENT_REMINDER_12H_FAILED, error as Error, { gameId }, { gameId });
  }
}

async function handlePaymentReminder24h(event: TypedDomainEvent) {
  if (event.type !== 'PaymentReminder24h') return;
  const { gameId } = event.payload;
  eventLogger.info('handlePaymentReminder24h', LOG_MESSAGES.EVENT_HANDLERS.PAYMENT_REMINDER_24H_PROCESSING, { gameId }, { gameId });

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
    eventLogger.warn('handlePaymentReminder24h', LOG_MESSAGES.EVENT_HANDLERS.PAYMENT_REMINDER_24H_NOT_FOUND, { gameId }, { gameId });
    return;
  }

  // Дополнительная проверка: отправляем только если окно оплаты открыто
  if (new Date() < game.startsAt) {
    eventLogger.info('handlePaymentReminder12h', LOG_MESSAGES.EVENT_HANDLERS.PAYMENT_REMINDER_12H_WINDOW_NOT_OPEN, { gameId, startsAt: game.startsAt }, { gameId });
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
    eventLogger.info('handlePaymentReminder24h', LOG_MESSAGES.EVENT_HANDLERS.PAYMENT_REMINDER_24H_SENT, {
      gameId,
      total: notifications.length,
      successful: result.successful,
      failed: result.failed
    }, { gameId });
  } catch (error) {
    eventLogger.error('handlePaymentReminder24h', LOG_MESSAGES.EVENT_HANDLERS.PAYMENT_REMINDER_24H_FAILED, error as Error, { gameId }, { gameId });
  }
}

async function handlePlayerJoined(event: TypedDomainEvent) {
  if (event.type !== 'PlayerJoined') return;
  const { gameId, userId, status } = event.payload;
  eventLogger.info('handlePlayerJoined', LOG_MESSAGES.EVENT_HANDLERS.PLAYER_JOINED_PROCESSING, { gameId, userId, status }, { gameId, userId });

  // Уведомить организатора
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { organizer: { include: { user: true } } }
  });

  if (!game?.organizer?.user?.telegramId) {
    eventLogger.warn('handlePlayerJoined', LOG_MESSAGES.EVENT_HANDLERS.PLAYER_JOINED_ORGANIZER_NOT_FOUND, { gameId, userId }, { gameId, userId });
    return;
  }

  const player = await prisma.user.findUnique({ where: { id: userId } });
  if (!player) {
    eventLogger.warn('handlePlayerJoined', LOG_MESSAGES.EVENT_HANDLERS.PLAYER_JOINED_PLAYER_NOT_FOUND, { gameId, userId }, { gameId, userId });
    return;
  }

  const statusText = status === 'confirmed' ? '✅ Подтвержден' : '⏳ В листе ожидания';
  const message = `👤 Новый участник в игре!\n${player.name} - ${statusText}`;

  try {
    await notificationService.sendNotification({
      userId: game.organizer.user.id,
      chatId: game.organizer.user.telegramId,
      message,
      type: 'player-joined',
      gameId
    });
    eventLogger.info('handlePlayerJoined', LOG_MESSAGES.EVENT_HANDLERS.PLAYER_JOINED_NOTIFICATION_SENT, { gameId, userId, organizerId: game.organizer.user.telegramId }, { gameId, userId });
  } catch (error) {
    eventLogger.error('handlePlayerJoined', LOG_MESSAGES.EVENT_HANDLERS.PLAYER_JOINED_NOTIFICATION_FAILED, error as Error, { gameId, userId }, { gameId, userId });
  }
}

async function handleWaitlistedPromoted(event: TypedDomainEvent) {
  if (event.type !== 'WaitlistedPromoted') return;
  const { gameId, userId } = event.payload;
  eventLogger.info('handleWaitlistedPromoted', LOG_MESSAGES.EVENT_HANDLERS.WAITLIST_PROMOTED_PROCESSING, { gameId, userId }, { gameId, userId });

  // Найти пользователя и уведомить
  const registration = await prisma.registration.findFirst({
    where: { gameId, userId },
    include: { user: true, game: true }
  });

  if (!registration?.user?.telegramId) {
    eventLogger.warn('handleWaitlistedPromoted', LOG_MESSAGES.EVENT_HANDLERS.WAITLIST_PROMOTED_USER_NOT_FOUND, { gameId, userId }, { gameId, userId });
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
    eventLogger.info('handleWaitlistedPromoted', LOG_MESSAGES.EVENT_HANDLERS.WAITLIST_PROMOTED_NOTIFICATION_SENT, { gameId, userId, userTelegramId: registration.user.telegramId }, { gameId, userId });
  } catch (error) {
    eventLogger.error('handleWaitlistedPromoted', LOG_MESSAGES.EVENT_HANDLERS.WAITLIST_PROMOTED_NOTIFICATION_FAILED, error as Error, { gameId, userId }, { gameId, userId });
  }
}

async function handlePaymentMarked(event: TypedDomainEvent) {
  if (event.type !== 'PaymentMarked') return;
  const { gameId, userId } = event.payload;
  eventLogger.info('handlePaymentMarked', LOG_MESSAGES.EVENT_HANDLERS.PAYMENT_MARKED_PROCESSING, { gameId, userId }, { gameId, userId });

  // Уведомить организатора
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { organizer: { include: { user: true } } }
  });

  if (!game?.organizer?.user?.telegramId) {
    eventLogger.warn('handlePaymentMarked', LOG_MESSAGES.EVENT_HANDLERS.PAYMENT_MARKED_ORGANIZER_NOT_FOUND, { gameId, userId }, { gameId, userId });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    eventLogger.warn('handlePaymentMarked', LOG_MESSAGES.EVENT_HANDLERS.PAYMENT_MARKED_USER_NOT_FOUND, { gameId, userId }, { gameId, userId });
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
    eventLogger.info('handlePaymentMarked', LOG_MESSAGES.EVENT_HANDLERS.PAYMENT_MARKED_NOTIFICATION_SENT, { gameId, userId, organizerId: game.organizer.user.telegramId }, { gameId, userId });
  } catch (error) {
    eventLogger.error('handlePaymentMarked', LOG_MESSAGES.EVENT_HANDLERS.PAYMENT_MARKED_NOTIFICATION_FAILED, error as Error, { gameId, userId }, { gameId, userId });
  }
}

async function handleSendPaymentReminders(event: TypedDomainEvent) {
  if (event.type !== 'SendPaymentReminders') return;
  const { gameId, unpaidRegistrations } = event.payload;
  eventLogger.info('handleSendPaymentReminders', LOG_MESSAGES.EVENT_HANDLERS.SEND_PAYMENT_REMINDERS_PROCESSING, { gameId, count: unpaidRegistrations.length }, { gameId });

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { organizer: { include: { user: true } } }
  });
  if (!game) {
    eventLogger.warn('handleSendPaymentReminders', LOG_MESSAGES.EVENT_HANDLERS.SEND_PAYMENT_REMINDERS_GAME_NOT_FOUND, { gameId }, { gameId });
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
    eventLogger.info('handleSendPaymentReminders', LOG_MESSAGES.EVENT_HANDLERS.SEND_PAYMENT_REMINDERS_SENT, {
      gameId,
      total: notifications.length,
      successful: result.successful,
      failed: result.failed
    }, { gameId });
  } catch (error) {
    eventLogger.error('handleSendPaymentReminders', LOG_MESSAGES.EVENT_HANDLERS.SEND_PAYMENT_REMINDERS_FAILED, error as Error, { gameId }, { gameId });
  }
}

async function handleRegistrationCanceled(event: TypedDomainEvent) {
  if (event.type !== 'RegistrationCanceled') return;
  const { gameId, userId } = event.payload;
  eventLogger.info('handleRegistrationCanceled', LOG_MESSAGES.EVENT_HANDLERS.REGISTRATION_CANCELED_PROCESSING, { gameId, userId }, { gameId, userId });

  // Уведомить организатора
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { organizer: { include: { user: true } } }
  });

  if (!game?.organizer?.user?.telegramId) {
    eventLogger.warn('handleRegistrationCanceled', LOG_MESSAGES.EVENT_HANDLERS.REGISTRATION_CANCELED_ORGANIZER_NOT_FOUND, { gameId, userId }, { gameId, userId });
    return;
  }

  const player = await prisma.user.findUnique({ where: { id: userId } });
  if (!player) {
    eventLogger.warn('handleRegistrationCanceled', LOG_MESSAGES.EVENT_HANDLERS.REGISTRATION_CANCELED_PLAYER_NOT_FOUND, { gameId, userId }, { gameId, userId });
    return;
  }

  const message = `❌ Отмена регистрации\nИгрок ${player.name} отменил участие в игре`;

  try {
    await notificationService.sendNotification({
      userId: game.organizer.user.id,
      chatId: game.organizer.user.telegramId,
      message,
      type: 'registration-canceled',
      gameId
    });
    eventLogger.info('handleRegistrationCanceled', LOG_MESSAGES.EVENT_HANDLERS.REGISTRATION_CANCELED_NOTIFICATION_SENT, { gameId, userId, organizerId: game.organizer.user.telegramId }, { gameId, userId });
  } catch (error) {
    eventLogger.error('handleRegistrationCanceled', LOG_MESSAGES.EVENT_HANDLERS.REGISTRATION_CANCELED_NOTIFICATION_FAILED, error as Error, { gameId, userId }, { gameId, userId });
  }
}

async function handleGameClosed(event: TypedDomainEvent) {
  if (event.type !== 'GameClosed') return;
  // Обработчик для закрытия игры - пока пустой, можно добавить логику позже
  eventLogger.info('handleGameClosed', LOG_MESSAGES.EVENT_HANDLERS.GAME_CLOSED_PROCESSING, { gameId: event.payload.gameId }, { gameId: event.payload.gameId });
}

async function handlePlayerLinkedToOrganizer(event: TypedDomainEvent) {
  if (event.type !== 'PlayerLinkedToOrganizer') return;
  // Обработчик для связи игрока с организатором - пока пустой, можно добавить логику позже
  eventLogger.info('handlePlayerLinkedToOrganizer', LOG_MESSAGES.EVENT_HANDLERS.PLAYER_LINKED_TO_ORGANIZER_PROCESSING, {
    playerId: event.payload.playerId,
    organizerId: event.payload.organizerId,
    playerName: event.payload.playerName
  });
}

async function handlePaymentAttemptRejectedEarly(event: TypedDomainEvent) {
  if (event.type !== 'PaymentAttemptRejectedEarly') return;
  // Обработчик для ранней попытки оплаты - пока пустой, можно добавить логику позже
  eventLogger.info('handlePaymentAttemptRejectedEarly', LOG_MESSAGES.EVENT_HANDLERS.PAYMENT_ATTEMPT_REJECTED_EARLY_PROCESSING, { gameId: event.payload.gameId, userId: event.payload.userId }, { gameId: event.payload.gameId, userId: event.payload.userId });
}

async function handlePlayerSelectedOrganizers(event: TypedDomainEvent) {
  if (event.type !== 'PlayerSelectedOrganizers') return;
  const { playerId, organizerIds } = event.payload;
  eventLogger.info('handlePlayerSelectedOrganizers', LOG_MESSAGES.EVENT_HANDLERS.PLAYER_SELECTED_ORGANIZERS_PROCESSING, { playerId, organizerIds });

  // Найти организаторов и уведомить их
  const organizers = await prisma.organizer.findMany({
    where: { id: { in: organizerIds } },
    include: { user: true }
  });

  const player = await prisma.user.findUnique({ where: { id: playerId } });
  if (!player) {
    eventLogger.warn('handlePlayerSelectedOrganizers', LOG_MESSAGES.EVENT_HANDLERS.PLAYER_SELECTED_ORGANIZERS_PLAYER_NOT_FOUND, { playerId });
    return;
  }

  const message = `👤 Новый запрос на связь!\nИгрок ${player.name} хочет присоединиться к вашим играм.`;

  const notifications = organizers
    .filter(org => org.user?.telegramId)
    .map(org => ({
      userId: org.userId,
      chatId: org.user!.telegramId!,
      message,
      type: 'player-selected-organizer',
      gameId: undefined,
      buttons: [
        [
          { text: '✅ Принять', callback_data: `confirm_player_${playerId}` },
          { text: '❌ Отказать', callback_data: `reject_player_${playerId}` }
        ]
      ]
    }));

  try {
    const result = await notificationService.sendBatch(notifications);
    eventLogger.info('handlePlayerSelectedOrganizers', LOG_MESSAGES.EVENT_HANDLERS.PLAYER_SELECTED_ORGANIZERS_NOTIFICATIONS_SENT, {
      playerId,
      organizerIds,
      successful: result.successful,
      failed: result.failed
    });
  } catch (error) {
    eventLogger.error('handlePlayerSelectedOrganizers', LOG_MESSAGES.EVENT_HANDLERS.PLAYER_SELECTED_ORGANIZERS_NOTIFICATIONS_FAILED, error as Error, { playerId, organizerIds });
  }
}

async function handlePlayerConfirmedByOrganizer(event: TypedDomainEvent) {
  if (event.type !== 'PlayerConfirmedByOrganizer') return;
  const { organizerId, playerId, playerName } = event.payload;
  eventLogger.info('handlePlayerConfirmedByOrganizer', LOG_MESSAGES.EVENT_HANDLERS.PLAYER_CONFIRMED_BY_ORGANIZER_PROCESSING, { organizerId, playerId, playerName });

  // Найти игрока и уведомить
  const player = await prisma.user.findUnique({ where: { id: playerId } });
  if (!player?.telegramId) {
    eventLogger.warn('handlePlayerConfirmedByOrganizer', LOG_MESSAGES.EVENT_HANDLERS.PLAYER_CONFIRMED_BY_ORGANIZER_PLAYER_NOT_FOUND, { playerId });
    return;
  }

  const organizer = await prisma.organizer.findUnique({
    where: { id: organizerId },
    include: { user: true }
  });

  const message = `✅ Поздравляем!\nОрганизатор ${organizer?.title || organizer?.user?.name || 'Unknown'} подтвердил вашу связь.\nТеперь вы будете получать приоритетные приглашения на игры!`;

  try {
    await notificationService.sendNotification({
      userId: playerId,
      chatId: player.telegramId,
      message,
      type: 'player-confirmed',
      gameId: undefined
    });
    eventLogger.info('handlePlayerConfirmedByOrganizer', LOG_MESSAGES.EVENT_HANDLERS.PLAYER_CONFIRMED_BY_ORGANIZER_NOTIFICATION_SENT, { playerId, organizerId });
  } catch (error) {
    eventLogger.error('handlePlayerConfirmedByOrganizer', LOG_MESSAGES.EVENT_HANDLERS.PLAYER_CONFIRMED_BY_ORGANIZER_NOTIFICATION_FAILED, error as Error, { playerId, organizerId });
  }
}

async function handlePlayerRejectedByOrganizer(event: TypedDomainEvent) {
  if (event.type !== 'PlayerRejectedByOrganizer') return;
  const { organizerId, playerId, playerName } = event.payload;
  eventLogger.info('handlePlayerRejectedByOrganizer', LOG_MESSAGES.EVENT_HANDLERS.PLAYER_REJECTED_BY_ORGANIZER_PROCESSING, { organizerId, playerId, playerName });

  // Найти игрока и уведомить
  const player = await prisma.user.findUnique({ where: { id: playerId } });
  if (!player?.telegramId) {
    eventLogger.warn('handlePlayerRejectedByOrganizer', LOG_MESSAGES.EVENT_HANDLERS.PLAYER_REJECTED_BY_ORGANIZER_PLAYER_NOT_FOUND, { playerId });
    return;
  }

  const organizer = await prisma.organizer.findUnique({
    where: { id: organizerId },
    include: { user: true }
  });

  const message = `❌ Связь отклонена\nОрганизатор ${organizer?.title || organizer?.user?.name || 'Unknown'} отклонил ваш запрос на связь.`;

  try {
    await notificationService.sendNotification({
      userId: playerId,
      chatId: player.telegramId,
      message,
      type: 'player-rejected',
      gameId: undefined
    });
    eventLogger.info('handlePlayerRejectedByOrganizer', LOG_MESSAGES.EVENT_HANDLERS.PLAYER_REJECTED_BY_ORGANIZER_NOTIFICATION_SENT, { playerId, organizerId });
  } catch (error) {
    eventLogger.error('handlePlayerRejectedByOrganizer', LOG_MESSAGES.EVENT_HANDLERS.PLAYER_REJECTED_BY_ORGANIZER_NOTIFICATION_FAILED, error as Error, { playerId, organizerId });
  }
}

async function handleGameCreatedWithPriorityWindow(event: TypedDomainEvent) {
  if (event.type !== 'GameCreatedWithPriorityWindow') return;
  const { gameId, priorityWindowClosesAt, confirmedPlayers } = event.payload;
  eventLogger.info('handleGameCreatedWithPriorityWindow', LOG_MESSAGES.EVENT_HANDLERS.GAME_CREATED_WITH_PRIORITY_WINDOW_PROCESSING, { gameId, priorityWindowClosesAt, confirmedPlayersCount: confirmedPlayers.length }, { gameId });

  // Найти игру для получения деталей
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { organizer: { include: { user: true } } }
  });

  if (!game) {
    eventLogger.warn('handleGameCreatedWithPriorityWindow', LOG_MESSAGES.EVENT_HANDLERS.GAME_CREATED_WITH_PRIORITY_WINDOW_GAME_NOT_FOUND, { gameId }, { gameId });
    return;
  }

  const gameTime = formatGameTimeForNotification(game.startsAt);
  const message = `🎾 Приоритетное приглашение!\n${
    gameTime
  }\n${
    getVenueName(game.venueId) || ''
  }\n💰 ${
    game.priceText || 'По согласованию'
  }\n${
    getOrganizerName(game)
  }\n\n⏰ У вас есть 2 часа на ответ!`;

  const notifications = confirmedPlayers
    .filter(player => player.telegramId)
    .map(player => ({
      userId: player.playerId,
      chatId: player.telegramId,
      message,
      type: 'priority-game-invitation',
      gameId,
      buttons: [
        [
          { text: '✅ Да', callback_data: `respond_game_${gameId}_yes` },
          { text: '❌ Нет', callback_data: `respond_game_${gameId}_no` }
        ]
      ]
    }));

  try {
    const result = await notificationService.sendBatch(notifications);
    eventLogger.info('handleGameCreatedWithPriorityWindow', LOG_MESSAGES.EVENT_HANDLERS.GAME_CREATED_WITH_PRIORITY_WINDOW_INVITATIONS_SENT, {
      gameId,
      total: notifications.length,
      successful: result.successful,
      failed: result.failed
    }, { gameId });
  } catch (error) {
    eventLogger.error('handleGameCreatedWithPriorityWindow', LOG_MESSAGES.EVENT_HANDLERS.GAME_CREATED_WITH_PRIORITY_WINDOW_INVITATIONS_FAILED, error as Error, { gameId }, { gameId });
  }
}

async function handlePlayerRespondedToGameInvitation(event: TypedDomainEvent) {
  if (event.type !== 'PlayerRespondedToGameInvitation') return;
  const { gameId, playerId, response } = event.payload;
  eventLogger.info('handlePlayerRespondedToGameInvitation', LOG_MESSAGES.EVENT_HANDLERS.PLAYER_RESPONDED_TO_GAME_INVITATION_PROCESSING, { gameId, playerId, response });

  // Найти организатора игры и уведомить о ответе
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { organizer: { include: { user: true } } }
  });

  if (!game?.organizer?.user?.telegramId) {
    eventLogger.warn('handlePlayerRespondedToGameInvitation', LOG_MESSAGES.EVENT_HANDLERS.PLAYER_RESPONDED_TO_GAME_INVITATION_ORGANIZER_NOT_FOUND, { gameId, playerId });
    return;
  }

  const player = await prisma.user.findUnique({ where: { id: playerId } });
  const responseText = response === 'yes' ? '✅ Да' : response === 'no' ? '❌ Нет' : '⏳ Игнорирует';

  // Если игрок ответил "yes", добавить его в игру
  if (response === 'yes') {
    try {
      const { joinGame } = await import('../application/use-cases.js');
      await joinGame(gameId, playerId);
      eventLogger.info('handlePlayerRespondedToGameInvitation', LOG_MESSAGES.EVENT_HANDLERS.PLAYER_RESPONDED_TO_GAME_INVITATION_AUTO_JOINED, { gameId, playerId });
    } catch (error) {
      eventLogger.error('handlePlayerRespondedToGameInvitation', LOG_MESSAGES.EVENT_HANDLERS.PLAYER_RESPONDED_TO_GAME_INVITATION_AUTO_JOIN_FAILED, error as Error, { gameId, playerId });
    }
  }

  const message = `📝 Ответ на приглашение\nИгрок ${player?.name || 'Unknown'}: ${responseText}\nИгра: ${gameId}`;

  try {
    await notificationService.sendNotification({
      userId: game.organizer.userId,
      chatId: game.organizer.user.telegramId,
      message,
      type: 'player-response',
      gameId
    });
    eventLogger.info('handlePlayerRespondedToGameInvitation', LOG_MESSAGES.EVENT_HANDLERS.PLAYER_RESPONDED_TO_GAME_INVITATION_RESPONSE_SENT, { gameId, playerId, response });
  } catch (error) {
    eventLogger.error('handlePlayerRespondedToGameInvitation', LOG_MESSAGES.EVENT_HANDLERS.PLAYER_RESPONDED_TO_GAME_INVITATION_RESPONSE_FAILED, error as Error, { gameId, playerId });
  }
}

async function handleGamePublishedForAll(event: TypedDomainEvent) {
  if (event.type !== 'GamePublishedForAll') return;
  const { gameId } = event.payload;
  eventLogger.info('handleGamePublishedForAll', LOG_MESSAGES.EVENT_HANDLERS.GAME_PUBLISHED_FOR_ALL_PROCESSING, { gameId }, { gameId });

  // Найти игру и отправить уведомления всем подходящим игрокам
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { organizer: { include: { user: true } } }
  });

  if (!game) {
    eventLogger.warn('handleGamePublishedForAll', LOG_MESSAGES.EVENT_HANDLERS.GAME_PUBLISHED_FOR_ALL_GAME_NOT_FOUND, { gameId }, { gameId });
    return;
  }

  // Обновить флаг publishedForAll
  await prisma.game.update({
    where: { id: gameId },
    data: { publishedForAll: true }
  });

  // Получить всех приоритетных игроков организатора (они уже получили приглашение)
  const priorityPlayers = await (prisma as any).playerOrganizer.findMany({
    where: {
      organizerId: game.organizerId,
      status: 'confirmed'
    },
    select: { playerId: true }
  });

  const priorityPlayerIds = new Set(priorityPlayers.map((p: any) => p.playerId));

  // Найти подходящих игроков: активные пользователи, которые не являются организатором и не приоритетными
  const suitableUsers = await prisma.user.findMany({
    where: {
      id: { not: game.organizer.userId } // Исключаем организатора
    },
    include: {
      notificationPreferences: true
    }
  });

  const filteredUsers = suitableUsers.filter(user =>
    user.telegramId !== null && !priorityPlayerIds.has(user.id)
  );

  const gameTime = formatGameTimeForNotification(game.startsAt);
  const message = `🎾 Новая игра доступна!\n${
    gameTime
  }\n${
    game.levelTag || 'Общий уровень'
  }\n💰 ${
    game.priceText || 'По согласованию с организатором'
  }\n${
    getOrganizerName(game)
  }\n`;

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
      type: 'game-published-for-all',
      gameId,
      buttons: [
        [
          { text: 'Присоединиться', callback_data: `join_game_${gameId}` }
        ]
      ]
    }));

  try {
    const result = await notificationService.sendBatch(notifications);
    eventLogger.info('handleGamePublishedForAll', LOG_MESSAGES.EVENT_HANDLERS.GAME_PUBLISHED_FOR_ALL_NOTIFICATIONS_SENT, {
      gameId,
      total: notifications.length,
      successful: result.successful,
      failed: result.failed
    }, { gameId });
  } catch (error) {
    eventLogger.error('handleGamePublishedForAll', LOG_MESSAGES.EVENT_HANDLERS.GAME_PUBLISHED_FOR_ALL_NOTIFICATIONS_FAILED, error as Error, { gameId }, { gameId });
  }
}