import { Queue, Worker } from 'bullmq';
import { logger } from './logger.js';

// Конфигурация Redis (используем переменные окружения)
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
};

// Очереди для разных типов задач
export const reminderQueue = new Queue('game-reminders', { connection: redisConfig });
export const paymentReminderQueue = new Queue('payment-reminders', { connection: redisConfig });

/**
 * Планирует напоминание за 24 часа до игры
 */
export async function scheduleGameReminder24h(gameId: string, startsAt: Date) {
  const delay = startsAt.getTime() - Date.now() - 24 * 60 * 60 * 1000;
  if (delay <= 0) return; // Не планировать, если время уже прошло

  await reminderQueue.add(
    'game-reminder-24h',
    { gameId },
    { delay, removeOnComplete: true, removeOnFail: true }
  );

  logger.info('Scheduled 24h reminder', { gameId, delay: Math.round(delay / 1000 / 60) + 'min' });
}

/**
 * Планирует напоминание за 2 часа до игры
 */
export async function scheduleGameReminder2h(gameId: string, startsAt: Date) {
  const delay = startsAt.getTime() - Date.now() - 2 * 60 * 60 * 1000;
  if (delay <= 0) return;

  await reminderQueue.add(
    'game-reminder-2h',
    { gameId },
    { delay, removeOnComplete: true, removeOnFail: true }
  );

  logger.info('Scheduled 2h reminder', { gameId, delay: Math.round(delay / 1000 / 60) + 'min' });
}

/**
 * Планирует напоминание об оплате через 12 часов после игры
 */
export async function schedulePaymentReminder12h(gameId: string, startsAt: Date) {
  const delay = startsAt.getTime() - Date.now() + 12 * 60 * 60 * 1000;
  if (delay <= 0) return;

  await paymentReminderQueue.add(
    'payment-reminder-12h',
    { gameId },
    { delay, removeOnComplete: true, removeOnFail: true }
  );

  logger.info('Scheduled payment 12h reminder', { gameId, delay: Math.round(delay / 1000 / 60) + 'min' });
}

/**
 * Планирует напоминание об оплате через 24 часа после игры
 */
export async function schedulePaymentReminder24h(gameId: string, startsAt: Date) {
  const delay = startsAt.getTime() - Date.now() + 24 * 60 * 60 * 1000;
  if (delay <= 0) return;

  await paymentReminderQueue.add(
    'payment-reminder-24h',
    { gameId },
    { delay, removeOnComplete: true, removeOnFail: true }
  );

  logger.info('Scheduled payment 24h reminder', { gameId, delay: Math.round(delay / 1000 / 60) + 'min' });
}

/**
 * Инициализирует воркеры для обработки задач
 */
export function initializeWorkers() {
  // Воркер для обработки напоминаний об играх
  const reminderWorker = new Worker(
    'game-reminders',
    async (job) => {
      const { gameId } = job.data;
      logger.info('Processing reminder job', { jobId: job.id, gameId, type: job.name });

      // Импортируем здесь, чтобы избежать циклических зависимостей
      const { EventBus } = await import('./event-bus.js');
      const eventBus = EventBus.getInstance();

      switch (job.name) {
        case 'game-reminder-24h':
          await eventBus.publish({ type: 'GameReminder24h', occurredAt: new Date(), id: '', payload: { gameId } });
          break;
        case 'game-reminder-2h':
          await eventBus.publish({ type: 'GameReminder2h', occurredAt: new Date(), id: '', payload: { gameId } });
          break;
        default:
          logger.warn('Unknown reminder job type', { jobId: job.id, type: job.name });
      }
    },
    { connection: redisConfig }
  );

  // Воркер для обработки напоминаний об оплате
  const paymentReminderWorker = new Worker(
    'payment-reminders',
    async (job) => {
      const { gameId } = job.data;
      logger.info('Processing payment reminder job', { jobId: job.id, gameId, type: job.name });

      const { EventBus } = await import('./event-bus.js');
      const eventBus = EventBus.getInstance();

      switch (job.name) {
        case 'payment-reminder-12h':
          await eventBus.publish({ type: 'PaymentReminder12h', occurredAt: new Date(), id: '', payload: { gameId } });
          break;
        case 'payment-reminder-24h':
          await eventBus.publish({ type: 'PaymentReminder24h', occurredAt: new Date(), id: '', payload: { gameId } });
          break;
        default:
          logger.warn('Unknown payment reminder job type', { jobId: job.id, type: job.name });
      }
    },
    { connection: redisConfig }
  );

  // Обработка ошибок воркеров
  reminderWorker.on('failed', (job, err) => {
    logger.error('Reminder job failed', { jobId: job?.id, error: err.message });
  });

  paymentReminderWorker.on('failed', (job, err) => {
    logger.error('Payment reminder job failed', { jobId: job?.id, error: err.message });
  });

  logger.info('Scheduler workers initialized');
}

/**
 * Graceful shutdown очередей
 */
export async function closeQueues() {
  await Promise.all([
    reminderQueue.close(),
    paymentReminderQueue.close(),
  ]);
  logger.info('Queues closed');
}