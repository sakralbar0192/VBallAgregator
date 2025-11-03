# Конкретные технические решения для VBallAgregator

## 🔥 Критичные исправления (Неделя 1)

### 1. Исправление инфраструктуры

#### A. Обновленный docker-compose.yml

```yaml
services:
  db:
    image: postgres:15
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: vball_db
    ports:
      - "5434:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user -d vball_db"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru

  app:
    build: .
    environment:
      DATABASE_URL: "postgresql://user:password@db:5432/vball_db?schema=public"
      REDIS_HOST: redis
      REDIS_PORT: 6379
      TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN}
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    ports:
      - "3000:3000"
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

#### B. Configuration Management

```typescript
// src/shared/config.ts
export interface AppConfig {
  database: {
    url: string;
    maxConnections: number;
    queryTimeout: number;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
    maxRetriesPerRequest: number;
  };
  telegram: {
    botToken: string;
    webhookUrl?: string;
  };
  localization: {
    defaultTimezone: string;
    supportedTimezones: string[];
  };
  notifications: {
    maxRetries: number;
    backoffMultiplier: number;
    batchSize: number;
  };
  queues: {
    concurrency: number;
    removeOnComplete: number;
    removeOnFail: number;
  };
}

function loadConfig(): AppConfig {
  return {
    database: {
      url: process.env.DATABASE_URL!,
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10'),
      queryTimeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000'),
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: 3,
    },
    telegram: {
      botToken: process.env.TELEGRAM_BOT_TOKEN!,
      webhookUrl: process.env.TELEGRAM_WEBHOOK_URL,
    },
    localization: {
      defaultTimezone: process.env.DEFAULT_TIMEZONE || 'Asia/Irkutsk',
      supportedTimezones: ['Asia/Irkutsk', 'Europe/Moscow', 'UTC'],
    },
    notifications: {
      maxRetries: parseInt(process.env.NOTIFICATION_RETRIES || '3'),
      backoffMultiplier: 2,
      batchSize: parseInt(process.env.NOTIFICATION_BATCH_SIZE || '50'),
    },
    queues: {
      concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '5'),
      removeOnComplete: parseInt(process.env.QUEUE_KEEP_COMPLETED || '100'),
      removeOnFail: parseInt(process.env.QUEUE_KEEP_FAILED || '50'),
    },
  };
}

export const config = loadConfig();

// Валидация конфигурации при старте
export function validateConfig(config: AppConfig): void {
  if (!config.database.url) {
    throw new Error('DATABASE_URL is required');
  }
  if (!config.telegram.botToken) {
    throw new Error('TELEGRAM_BOT_TOKEN is required');
  }
  if (config.notifications.maxRetries < 1 || config.notifications.maxRetries > 10) {
    throw new Error('NOTIFICATION_RETRIES must be between 1 and 10');
  }
}
```

### 2. Application Service Pattern

```typescript
// src/application/services/game-service.ts
import { GameRepo, RegistrationRepo } from '../../infrastructure/repositories.js';
import { EventBus } from '../../shared/event-bus.js';
import { GameDomainService } from '../../domain/services/game-domain-service.js';
import { SchedulerService } from '../../shared/scheduler-service.js';

export interface MarkPaymentCommand {
  gameId: string;
  userId: string;
}

export interface JoinGameCommand {
  gameId: string;
  userId: string;
}

export class GameApplicationService {
  constructor(
    private gameRepo: GameRepo,
    private registrationRepo: RegistrationRepo,
    private eventBus: EventBus,
    private gameDomainService: GameDomainService,
    private schedulerService: SchedulerService
  ) {}

  async markPayment(command: MarkPaymentCommand): Promise<void> {
    const { game, registration } = await this.gameDomainService
      .validatePaymentMarking(command.gameId, command.userId);

    // Доменная логика
    registration.markPaid(game);

    // Персистенция
    await this.registrationRepo.upsert(registration);

    // События - отложенная обработка через event bus
    await this.eventBus.publish({
      type: 'PaymentMarked',
      payload: { gameId: command.gameId, userId: command.userId },
      occurredAt: new Date(),
    });
  }

  async joinGame(command: JoinGameCommand): Promise<{ status: string }> {
    return await this.gameRepo.transaction(async () => {
      const result = await this.gameDomainService.processJoinGame(
        command.gameId,
        command.userId
      );

      await this.eventBus.publish({
        type: 'PlayerJoined',
        payload: { 
          gameId: command.gameId, 
          userId: command.userId, 
          status: result.status 
        },
        occurredAt: new Date(),
      });

      return result;
    });
  }
}

// src/domain/services/game-domain-service.ts
export class GameDomainService {
  constructor(
    private gameRepo: GameRepo,
    private registrationRepo: RegistrationRepo
  ) {}

  async validatePaymentMarking(gameId: string, userId: string) {
    const game = await this.gameRepo.findById(gameId);
    if (!game) throw new DomainError('NOT_FOUND', 'Игра не найдена');

    const registration = await this.registrationRepo.get(gameId, userId);
    if (!registration || registration.status !== RegStatus.confirmed) {
      throw new DomainError('NOT_CONFIRMED', 'Только подтвержденные участники могут отмечать оплату');
    }

    return { game, registration };
  }

  async processJoinGame(gameId: string, userId: string) {
    // Advisory lock уже в repo.transaction
    const game = await this.gameRepo.findById(gameId);
    if (!game) throw new DomainError('NOT_FOUND', 'Игра не найдена');

    const confirmedCount = await this.gameRepo.countConfirmed(gameId);
    const existing = await this.registrationRepo.get(gameId, userId);

    if (existing) {
      return { status: existing.status };
    }

    const status = confirmedCount < game.capacity ? RegStatus.confirmed : RegStatus.waitlisted;

    if (status === RegStatus.confirmed) {
      game.ensureCanJoin(confirmedCount);
    }

    const registration = new Registration(uuid(), gameId, userId, status);
    await this.registrationRepo.upsert(registration);

    return { status };
  }
}
```

### 3. Event Bus с обработкой ошибок

```typescript
// src/shared/event-bus.ts
export interface DomainEvent {
  type: string;
  payload: any;
  occurredAt: Date;
  id?: string;
}

export interface EventHandler {
  handle(event: DomainEvent): Promise<void>;
}

export class EventBus {
  private handlers = new Map<string, EventHandler[]>();
  private deadLetterQueue: DomainEvent[] = [];

  subscribe(eventType: string, handler: EventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
  }

  async publish(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.type) || [];
    
    const results = await Promise.allSettled(
      handlers.map(handler => this.handleWithRetry(handler, event))
    );

    // Проверяем неуспешную обработку
    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      logger.error('Event processing failures', { 
        eventType: event.type, 
        failures: failures.length,
        totalHandlers: handlers.length 
      });
      
      // Отправляем в dead letter queue
      this.deadLetterQueue.push(event);
    }
  }

  private async handleWithRetry(handler: EventHandler, event: DomainEvent, maxRetries = 3): Promise<void> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await handler.handle(event);
        return;
      } catch (error) {
        logger.warn('Event handler failed', { 
          eventType: event.type, 
          attempt: attempt + 1, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });

        if (attempt === maxRetries) {
          throw error;
        }

        // Exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  getDeadLetterQueue(): DomainEvent[] {
    return [...this.deadLetterQueue];
  }

  clearDeadLetterQueue(): void {
    this.deadLetterQueue.length = 0;
  }
}
```

## ⚙️ Важные улучшения (Неделя 2)

### 4. Улучшенный Scheduler с мониторингом

```typescript
// src/shared/scheduler-service.ts
import { Queue, Worker, Job } from 'bullmq';
import { config } from './config.js';
import { EventBus } from './event-bus.js';

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
```

### 5. Улучшенный Notification Service с батчингом

```typescript
// src/shared/notification-service.ts
export interface NotificationBatch {
  userId: string;
  chatId: bigint;
  message: string;
  type: string;
}

export interface BatchResult {
  successful: number;
  failed: number;
  errors: Array<{ userId: string; error: string }>;
}

export class NotificationService {
  private bot: Telegraf;
  private metrics = new NotificationTracker();

  constructor(botToken: string) {
    this.bot = new Telegraf(botToken);
  }

  async sendBatch(notifications: NotificationBatch[]): Promise<BatchResult> {
    const chunks = this.chunkArray(notifications, config.notifications.batchSize);
    const results: BatchResult[] = [];

    for (const chunk of chunks) {
      const chunkResult = await this.processBatch(chunk);
      results.push(chunkResult);
      
      // Rate limiting - пауза между батчами
      if (chunks.indexOf(chunk) < chunks.length - 1) {
        await this.delay(100); // 100ms между батчами
      }
    }

    return this.aggregateResults(results);
  }

  private async processBatch(batch: NotificationBatch[]): Promise<BatchResult> {
    const results = await Promise.allSettled(
      batch.map(notification => this.sendMessage(
        notification.chatId, 
        notification.message,
        notification.type
      ))
    );

    const result: BatchResult = {
      successful: 0,
      failed: 0,
      errors: [],
    };

    results.forEach((res, index) => {
      if (res.status === 'fulfilled') {
        result.successful++;
      } else {
        result.failed++;
        result.errors.push({
          userId: batch[index]!.userId,
          error: res.reason.message || 'Unknown error',
        });
      }
    });

    return result;
  }

  async sendMessage(chatId: bigint | number, text: string, type: string = 'unknown'): Promise<void> {
    const maxRetries = config.notifications.maxRetries;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await this.bot.telegram.sendMessage(Number(chatId), text);
        
        // Метрики
        if (attempt === 0) {
          this.metrics.recordSent(type);
          this.metrics.recordDelivered(type);
        } else {
          this.metrics.recordRetry(type);
        }
        
        logger.info('Notification sent', { 
          chatId, 
          type,
          attempt: attempt + 1,
          textLength: text.length 
        });
        return;
        
      } catch (error: any) {
        this.metrics.recordFailed(type);
        
        // Анализ типа ошибки
        if (this.isPermanentError(error)) {
          logger.error('Permanent notification error', { 
            chatId, 
            type, 
            error: error.message 
          });
          throw error; // Не ретраим permanent ошибки
        }

        logger.warn('Temporary notification error', { 
          chatId, 
          type,
          attempt: attempt + 1, 
          error: error.message 
        });

        if (attempt === maxRetries) {
          throw error;
        }

        // Exponential backoff с jitter
        const baseDelay = Math.pow(config.notifications.backoffMultiplier, attempt) * 1000;
        const jitter = Math.random() * 500; // До 500ms случайной задержки
        await this.delay(baseDelay + jitter);
      }
    }
  }

  private isPermanentError(error: any): boolean {
    const permanentErrorCodes = [
      'ETELEGRAM_BLOCKED_BY_USER',
      'ETELEGRAM_USER_DEACTIVATED', 
      'ETELEGRAM_CHAT_NOT_FOUND',
    ];
    
    return permanentErrorCodes.some(code => 
      error.code === code || error.message?.includes(code)
    );
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private aggregateResults(results: BatchResult[]): BatchResult {
    return results.reduce(
      (acc, result) => ({
        successful: acc.successful + result.successful,
        failed: acc.failed + result.failed,
        errors: [...acc.errors, ...result.errors],
      }),
      { successful: 0, failed: 0, errors: [] }
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getMetrics() {
    return this.metrics.getAllMetrics();
  }
}
```

## 📊 Мониторинг и Health Checks (Неделя 3)

### 6. Health Check Service

```typescript
// src/infrastructure/health.ts
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, CheckResult>;
  timestamp: string;
}

export interface CheckResult {
  status: 'up' | 'down';
  responseTime?: number;
  error?: string;
  details?: any;
}

export class HealthCheckService {
  constructor(
    private prisma: any,
    private redis: any,
    private schedulerService: SchedulerService
  ) {}

  async checkHealth(): Promise<HealthStatus> {
    const start = Date.now();
    const checks: Record<string, CheckResult> = {};

    // Параллельные проверки
    const [db, redis, queues, telegram] = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkQueues(),
      this.checkTelegramAPI(),
    ]);

    checks.database = this.processCheckResult(db);
    checks.redis = this.processCheckResult(redis);
    checks.queues = this.processCheckResult(queues);
    checks.telegram = this.processCheckResult(telegram);

    const overallStatus = this.calculateOverallStatus(checks);

    return {
      status: overallStatus,
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDatabase(): Promise<CheckResult> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'up',
        responseTime: Date.now() - start,
      };
    } catch (error) {
      return {
        status: 'down',
        responseTime: Date.now() - start,
        error: error instanceof Error ? error.message : 'Database connection failed',
      };
    }
  }

  private async checkRedis(): Promise<CheckResult> {
    const start = Date.now();
    try {
      const result = await this.redis.ping();
      return {
        status: result === 'PONG' ? 'up' : 'down',
        responseTime: Date.now() - start,
      };
    } catch (error) {
      return {
        status: 'down',
        responseTime: Date.now() - start,
        error: error instanceof Error ? error.message : 'Redis connection failed',
      };
    }
  }

  private async checkQueues(): Promise<CheckResult> {
    const start = Date.now();
    try {
      const stats = await this.schedulerService.getQueueStats();
      const hasStalled = stats.reminderStats.failed.length > 10 || stats.paymentStats.failed.length > 10;
      
      return {
        status: hasStalled ? 'down' : 'up',
        responseTime: Date.now() - start,
        details: stats,
      };
    } catch (error) {
      return {
        status: 'down',
        responseTime: Date.now() - start,
        error: error instanceof Error ? error.message : 'Queue check failed',
      };
    }
  }

  private async checkTelegramAPI(): Promise<CheckResult> {
    const start = Date.now();
    try {
      // Простой запрос к API Telegram
      const response = await fetch(`https://api.telegram.org/bot${config.telegram.botToken}/getMe`);
      const isOk = response.ok;
      
      return {
        status: isOk ? 'up' : 'down',
        responseTime: Date.now() - start,
        details: isOk ? undefined : await response.text(),
      };
    } catch (error) {
      return {
        status: 'down',
        responseTime: Date.now() - start,
        error: error instanceof Error ? error.message : 'Telegram API check failed',
      };
    }
  }

  private processCheckResult(result: PromiseSettledResult<CheckResult>): CheckResult {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        status: 'down',
        error: result.reason?.message || 'Check failed',
      };
    }
  }

  private calculateOverallStatus(checks: Record<string, CheckResult>): 'healthy' | 'degraded' | 'unhealthy' {
    const results = Object.values(checks);
    const downCount = results.filter(check => check.status === 'down').length;

    if (downCount === 0) return 'healthy';
    if (downCount === 1) return 'degraded';
    return 'unhealthy';
  }
}

// src/api/health-endpoint.ts  
import { FastifyInstance } from 'fastify';

export async function healthRoutes(fastify: FastifyInstance) {
  const healthService = fastify.diContainer.resolve(HealthCheckService);

  fastify.get('/health', async (request, reply) => {
    const health = await healthService.checkHealth();
    
    const statusCode = health.status === 'healthy' ? 200 
                     : health.status === 'degraded' ? 200 
                     : 503;

    reply.code(statusCode).send(health);
  });

  fastify.get('/health/ready', async (request, reply) => {
    const health = await healthService.checkHealth();
    const isReady = health.status !== 'unhealthy';
    
    reply.code(isReady ? 200 : 503).send({
      ready: isReady,
      timestamp: health.timestamp,
    });
  });

  fastify.get('/health/live', async (request, reply) => {
    // Простая проверка - приложение запущено
    reply.send({ alive: true, timestamp: new Date().toISOString() });
  });
}
```

### 7. Обновленный index.ts с graceful shutdown

```typescript
// index.ts
import 'dotenv/config';
import { validateConfig, config } from './src/shared/config.js';
import { bot } from './src/bot/index.js';
import { SchedulerService } from './src/shared/scheduler-service.js';
import { EventBus } from './src/shared/event-bus.js';
import { HealthCheckService } from './src/infrastructure/health.js';
import { setupEventHandlers } from './src/infrastructure/event-setup.js';
import { logger } from './src/shared/logger.js';

async function startApp() {
  try {
    // 1. Валидация конфигурации
    validateConfig(config);
    logger.info('Configuration validated');

    // 2. Инициализация сервисов
    const eventBus = new EventBus();
    const schedulerService = new SchedulerService(eventBus);
    const healthService = new HealthCheckService(
      prisma,
      redis,
      schedulerService
    );

    // 3. Настройка обработчиков событий
    await setupEventHandlers(eventBus);
    logger.info('Event handlers registered');

    // 4. Инициализация workers
    schedulerService.initializeWorkers();
    logger.info('Queue workers initialized');

    // 5. Проверка здоровья системы
    const health = await healthService.checkHealth();
    if (health.status === 'unhealthy') {
      throw new Error(`System unhealthy: ${JSON.stringify(health.checks)}`);
    }
    logger.info('Health check passed', { status: health.status });

    // 6. Запуск бота
    await bot.launch();
    logger.info('Bot started successfully');

    // 7. Настройка graceful shutdown
    setupGracefulShutdown(schedulerService);

  } catch (error) {
    logger.error('Failed to start application', { error: error instanceof Error ? error.message : error });
    process.exit(1);
  }
}

function setupGracefulShutdown(schedulerService: SchedulerService) {
  const gracefulShutdown = async (signal: string) => {
    logger.info('Graceful shutdown initiated', { signal });

    try {
      // 1. Остановка приема новых запросов
      bot.stop(signal);
      logger.info('Bot stopped');

      // 2. Завершение текущих задач (timeout 30 секунд)
      await Promise.race([
        schedulerService.close(),
        new Promise(resolve => setTimeout(resolve, 30000)),
      ]);
      logger.info('Scheduler closed');

      // 3. Закрытие БД соединений
      await prisma.$disconnect();
      logger.info('Database disconnected');

      logger.info('Graceful shutdown completed');
      process.exit(0);

    } catch (error) {
      logger.error('Error during graceful shutdown', { error: error instanceof Error ? error.message : error });
      process.exit(1);
    }
  };

  process.once('SIGINT', () => gracefulShutdown('SIGINT'));
  process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.once('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // nodemon совместимость
}

startApp().catch(error => {
  logger.error('Unhandled error during startup', { error: error instanceof Error ? error.message : error });
  process.exit(1);
});