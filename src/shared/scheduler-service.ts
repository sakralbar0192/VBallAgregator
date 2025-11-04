import { Queue, Worker, Job } from 'bullmq';
import { config } from './config.js';
import { EventBus } from './event-bus.js';
import { logger } from './logger.js';

export class SchedulerService {
  private reminderQueue: Queue;
  private paymentReminderQueue: Queue;
  private workers: Worker[] = [];

  constructor(private eventBus: EventBus) {
    this.reminderQueue = new Queue('game-reminders', {
      connection: config.redis,
      defaultJobOptions: {
        removeOnComplete: config.queues.removeOnComplete,
        removeOnFail: config.queues.removeOnFail,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });

    this.paymentReminderQueue = new Queue('payment-reminders', {
      connection: config.redis,
      defaultJobOptions: {
        removeOnComplete: config.queues.removeOnComplete,
        removeOnFail: config.queues.removeOnFail,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });
  }

  async scheduleGameReminder24h(gameId: string, startsAt: Date): Promise<void> {
    const delay = startsAt.getTime() - Date.now() - 24 * 60 * 60 * 1000;
    if (delay <= 0) return;

    await this.reminderQueue.add(
      'game-reminder-24h',
      { gameId },
      {
        delay,
        jobId: `game-reminder-24h-${gameId}`, // Предотвращаем дублирование
      }
    );

    logger.info('Scheduled 24h reminder', {
      gameId,
      scheduledFor: new Date(Date.now() + delay).toISOString()
    });
  }

  async schedulePaymentReminder12h(gameId: string, startsAt: Date): Promise<void> {
    const delay = startsAt.getTime() - Date.now() + 12 * 60 * 60 * 1000;
    if (delay <= 0) return;

    await this.paymentReminderQueue.add(
      'payment-reminder-12h',
      { gameId },
      {
        delay,
        jobId: `payment-reminder-12h-${gameId}`,
      }
    );

    logger.info('Scheduled payment 12h reminder', {
      gameId,
      scheduledFor: new Date(Date.now() + delay).toISOString()
    });
  }

  async schedulePaymentReminder24h(gameId: string, startsAt: Date): Promise<void> {
    const delay = startsAt.getTime() - Date.now() + 24 * 60 * 60 * 1000;
    if (delay <= 0) return;

    await this.paymentReminderQueue.add(
      'payment-reminder-24h',
      { gameId },
      {
        delay,
        jobId: `payment-reminder-24h-${gameId}`,
      }
    );

    logger.info('Scheduled payment 24h reminder', {
      gameId,
      scheduledFor: new Date(Date.now() + delay).toISOString()
    });
  }

  initializeWorkers(): void {
    // Game reminders worker
    const reminderWorker = new Worker(
      'game-reminders',
      async (job: Job) => {
        await this.processReminderJob(job);
      },
      {
        connection: config.redis,
        concurrency: config.queues.concurrency,
      }
    );

    // Payment reminders worker
    const paymentWorker = new Worker(
      'payment-reminders',
      async (job: Job) => {
        await this.processPaymentReminderJob(job);
      },
      {
        connection: config.redis,
        concurrency: config.queues.concurrency,
      }
    );

    this.workers = [reminderWorker, paymentWorker];

    // Error handling
    this.workers.forEach(worker => {
      worker.on('failed', (job, err) => {
        logger.error('Job failed', {
          jobId: job?.id,
          jobName: job?.name,
          error: err.message,
          attempts: job?.attemptsMade,
        });
      });

      worker.on('stalled', (jobId) => {
        logger.warn('Job stalled', { jobId });
      });
    });
  }

  private async processReminderJob(job: Job): Promise<void> {
    const { gameId } = job.data;

    switch (job.name) {
      case 'game-reminder-24h':
        await this.eventBus.publish({
          type: 'GameReminder24h',
          payload: { gameId },
          occurredAt: new Date(),
        });
        break;
      case 'game-reminder-2h':
        await this.eventBus.publish({
          type: 'GameReminder2h',
          payload: { gameId },
          occurredAt: new Date(),
        });
        break;
      default:
        logger.warn('Unknown reminder job type', { jobName: job.name });
    }
  }

  private async processPaymentReminderJob(job: Job): Promise<void> {
    const { gameId } = job.data;

    switch (job.name) {
      case 'payment-reminder-12h':
        await this.eventBus.publish({
          type: 'PaymentReminder12h',
          payload: { gameId },
          occurredAt: new Date(),
        });
        break;
      case 'payment-reminder-24h':
        await this.eventBus.publish({
          type: 'PaymentReminder24h',
          payload: { gameId },
          occurredAt: new Date(),
        });
        break;
      default:
        logger.warn('Unknown payment reminder job type', { jobName: job.name });
    }
  }

  async getQueueStats() {
    const [reminderStats, paymentStats] = await Promise.all([
      {
        name: 'game-reminders',
        waiting: await this.reminderQueue.getWaiting(),
        active: await this.reminderQueue.getActive(),
        completed: await this.reminderQueue.getCompleted(),
        failed: await this.reminderQueue.getFailed(),
      },
      {
        name: 'payment-reminders',
        waiting: await this.paymentReminderQueue.getWaiting(),
        active: await this.paymentReminderQueue.getActive(),
        completed: await this.paymentReminderQueue.getCompleted(),
        failed: await this.paymentReminderQueue.getFailed(),
      },
    ]);

    return { reminderStats, paymentStats };
  }

  async close(): Promise<void> {
    await Promise.all([
      ...this.workers.map(worker => worker.close()),
      this.reminderQueue.close(),
      this.paymentReminderQueue.close(),
    ]);
  }
}