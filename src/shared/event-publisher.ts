import type { DomainEvent } from './types.js';
import { v4 as uuid } from 'uuid';
import { Telegraf } from 'telegraf';
import { prisma } from '../infrastructure/prisma.js';
import { logger } from './logger.js';
import { formatGameTimeForNotification, getUserTimezone } from './date-utils.js';
import { NotificationTracker } from './notification-metrics.js';

/**
 * Интерфейс для публикации событий.
 */
export interface EventPublisher {
  publish(event: DomainEvent): Promise<void>;
}

/**
 * Реализация интерфейса EventPublisher для хранения событий в памяти.
 */
export class InMemoryEventPublisher implements EventPublisher {
  private handlers = new Map<string, ((event: DomainEvent) => Promise<void>)[]>();

  subscribe(eventType: string, handler: (event: DomainEvent) => Promise<void>) {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
  }

  async publish(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.type) || [];
    await Promise.all(handlers.map(handler => handler(event)));
  }
}

export const eventPublisher = new InMemoryEventPublisher();

// Сервис для отправки уведомлений через Telegram
class NotificationService {
  private bot: Telegraf;

  constructor(botToken: string) {
    this.bot = new Telegraf(botToken);
  }

  async sendMessage(chatId: bigint | number, text: string, retries = 3): Promise<void> {
    const notificationType = this.extractNotificationType(text);

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        await this.bot.telegram.sendMessage(Number(chatId), text);

        if (attempt === 0) {
          NotificationTracker.recordSent(notificationType);
          NotificationTracker.recordDelivered(notificationType);
          logger.info('Notification sent', { chatId, text: text.substring(0, 50) + '...', attempt: attempt + 1 });
        } else {
          NotificationTracker.recordRetry(notificationType);
          logger.info('Notification sent after retry', { chatId, attempt: attempt + 1 });
        }
        return;
      } catch (error: any) {
        NotificationTracker.recordFailed(notificationType);
        logger.warn('Failed to send notification', { chatId, attempt: attempt + 1, error: error.message });

        if (attempt === retries) {
          logger.error('Notification failed after all retries', { chatId, retries });
          throw error;
        }

        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  private extractNotificationType(text: string): string {
    if (text.includes('Напоминание: игра завтра')) return 'game-reminder-24h';
    if (text.includes('Через 2 часа игра')) return 'game-reminder-2h';
    if (text.includes('Напоминание: оплата за игру')) return 'payment-reminder-12h';
    if (text.includes('Последнее напоминание об оплате')) return 'payment-reminder-24h';
    if (text.includes('Новый участник в игре')) return 'player-joined';
    if (text.includes('Поздравляем! Вы продвинуты из листа ожидания')) return 'waitlist-promoted';
    if (text.includes('Оплата получена')) return 'payment-marked';
    return 'unknown';
  }
}

const notificationService = new NotificationService(process.env.TELEGRAM_BOT_TOKEN!);

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

// Обработчики событий для уведомлений
async function handleGameReminder24h(event: DomainEvent) {
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

  if (!game) return;

  const message = `⏰ Напоминание: игра завтра в ${formatGameTimeForNotification(game.startsAt)}!\n🏟️ ${game.levelTag || 'Общий уровень'}\n💰 ${game.priceText || 'Бесплатно'}`;

  for (const reg of game.registrations) {
    if (reg.user.telegramId) {
      const userTz = getUserTimezone(reg.userId);
      const personalizedMessage = `⏰ Напоминание: игра завтра в ${formatGameTimeForNotification(game.startsAt, userTz)}!\n🏟️ ${game.levelTag || 'Общий уровень'}\n💰 ${game.priceText || 'Бесплатно'}`;
      await notificationService.sendMessage(reg.user.telegramId, personalizedMessage);
    }
  }
}

async function handleGameReminder2h(event: DomainEvent) {
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

  if (!game) return;

  const message = `🚨 Через 2 часа игра!\n⏰ ${formatGameTimeForNotification(game.startsAt)}\n🏟️ ${game.levelTag || 'Общий уровень'}\n💰 ${game.priceText || 'Бесплатно'}`;

  for (const reg of game.registrations) {
    if (reg.user.telegramId) {
      const userTz = getUserTimezone(reg.userId);
      const personalizedMessage = `🚨 Через 2 часа игра!\n⏰ ${formatGameTimeForNotification(game.startsAt, userTz)}\n🏟️ ${game.levelTag || 'Общий уровень'}\n💰 ${game.priceText || 'Бесплатно'}`;
      await notificationService.sendMessage(reg.user.telegramId, personalizedMessage);
    }
  }
}

async function handlePaymentReminder12h(event: DomainEvent) {
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

  if (!game) return;

  const message = `💰 Напоминание: оплата за игру "${game.levelTag || 'Волейбол'}"\nОрганизатор: ${game.organizerId}\n💳 Пожалуйста, произведите оплату`;

  for (const reg of game.registrations) {
    if (reg.user.telegramId) {
      await notificationService.sendMessage(reg.user.telegramId, message);
    }
  }
}

async function handlePaymentReminder24h(event: DomainEvent) {
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

  if (!game) return;

  const message = `⚠️ Последнее напоминание об оплате!\n💰 Игра "${game.levelTag || 'Волейбол'}"\nОрганизатор: ${game.organizerId}\n⏰ Просьба оплатить в ближайшее время`;

  for (const reg of game.registrations) {
    if (reg.user.telegramId) {
      await notificationService.sendMessage(reg.user.telegramId, message);
    }
  }
}

async function handlePlayerJoined(event: DomainEvent) {
  const { gameId, userId, status } = event.payload;
  logger.info('Processing PlayerJoined', { gameId, userId, status });

  // Уведомить организатора
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { organizer: { include: { user: true } } }
  });

  if (!game?.organizer?.user?.telegramId) return;

  const user = await getUserData(game.organizer.user.telegramId);
  if (!user) return;

  const statusText = status === 'confirmed' ? '✅ Подтвержден' : '⏳ В листе ожидания';
  const message = `👤 Новый участник в игре!\n${user.name} - ${statusText}`;

  await notificationService.sendMessage(game.organizer.user.telegramId, message);
}

async function handleWaitlistedPromoted(event: DomainEvent) {
  const { gameId, userId } = event.payload;
  logger.info('Processing WaitlistedPromoted', { gameId, userId });

  // Найти пользователя и уведомить
  const registration = await prisma.registration.findFirst({
    where: { gameId, userId },
    include: { user: true, game: true }
  });

  if (!registration?.user?.telegramId) return;

  const userTz = getUserTimezone(registration.userId);
  const gameTime = formatGameTimeForNotification(registration.game.startsAt, userTz);
  const message = `🎉 Поздравляем! Вы продвинуты из листа ожидания!\n✅ Место подтверждено на игру ${gameTime}\n💰 Не забудьте оплатить участие`;

  await notificationService.sendMessage(registration.user.telegramId, message);
}

async function handlePaymentMarked(event: DomainEvent) {
  const { gameId, userId } = event.payload;
  logger.info('Processing PaymentMarked', { gameId, userId });

  // Уведомить организатора
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { organizer: { include: { user: true } } }
  });

  if (!game?.organizer?.user?.telegramId) return;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  const message = `💰 Оплата получена!\n👤 ${user.name} отметил оплату за игру`;

  await notificationService.sendMessage(game.organizer.user.telegramId, message);
}

// Подписываемся на все события уведомлений
eventPublisher.subscribe('GameReminder24h', handleGameReminder24h);
eventPublisher.subscribe('GameReminder2h', handleGameReminder2h);
eventPublisher.subscribe('PaymentReminder12h', handlePaymentReminder12h);
eventPublisher.subscribe('PaymentReminder24h', handlePaymentReminder24h);
eventPublisher.subscribe('PlayerJoined', handlePlayerJoined);
eventPublisher.subscribe('WaitlistedPromoted', handleWaitlistedPromoted);
eventPublisher.subscribe('PaymentMarked', handlePaymentMarked);

export function evt<T extends DomainEvent>(type: T['type'], payload: T['payload']): T {
  return {
    type,
    occurredAt: new Date(),
    id: uuid(),
    payload
  } as T;
}