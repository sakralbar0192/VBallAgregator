import 'dotenv/config';
import { validateConfig, config } from './src/shared/config.js';
import bot from './src/bot/bot.js';
import { SchedulerService } from './src/shared/scheduler-service.js';
import { EventBus } from './src/shared/event-bus.js';
import { HealthCheckService } from './src/infrastructure/health.js';
import { registerEventHandlers } from './src/shared/event-handlers.js';
import { startupLogger } from './src/shared/layer-logger.js';
import { LOG_MESSAGES } from './src/shared/logging-messages.js';
import { prisma } from './src/infrastructure/prisma.js';
import { createClient } from 'redis';

async function startApp() {
  try {
    // 1. Валидация конфигурации
    validateConfig(config);
    startupLogger.info('validateConfig', LOG_MESSAGES.STARTUP.CONFIG_VALIDATED);

    // 2. Инициализация сервисов
    const redisClient = createClient({
      socket: {
        host: config.redis.host,
        port: config.redis.port,
      },
      password: config.redis.password,
    });
    await redisClient.connect();

    const eventBus = EventBus.getInstance();
    const schedulerService = new SchedulerService(eventBus);
    const healthService = new HealthCheckService(
      prisma,
      redisClient,
      schedulerService
    );

    // 3. Настройка обработчиков событий
    await registerEventHandlers(eventBus);
    startupLogger.info('registerEventHandlers', LOG_MESSAGES.STARTUP.EVENT_HANDLERS_REGISTERED);

    // 4. Инициализация workers
    schedulerService.initializeWorkers();
    startupLogger.info('initializeWorkers', LOG_MESSAGES.STARTUP.QUEUE_WORKERS_INITIALIZED);

    // 5. Проверка здоровья системы
    const health = await healthService.checkHealth();
    if (health.status === 'unhealthy') {
      throw new Error(`System unhealthy: ${JSON.stringify(health.checks)}`);
    }
    startupLogger.info('checkHealth', LOG_MESSAGES.STARTUP.HEALTH_CHECK_PASSED, { status: health.status });

    // 6. Запуск бота
    await bot.launch();
    startupLogger.info('launchBot', LOG_MESSAGES.STARTUP.BOT_STARTED_SUCCESSFULLY);

    // 7. Настройка graceful shutdown
    setupGracefulShutdown(schedulerService, redisClient);

  } catch (error) {
    startupLogger.error('startApp', LOG_MESSAGES.STARTUP.FAILED_TO_START_APPLICATION, error as Error, {
        error: error instanceof Error ? error.message : error
    });
    process.exit(1);
  }
}

function setupGracefulShutdown(schedulerService: SchedulerService, redisClient: any) {
  const gracefulShutdown = async (signal: string) => {
    startupLogger.info('gracefulShutdown', LOG_MESSAGES.STARTUP.GRACEFUL_SHUTDOWN_INITIATED, { signal });

    try {
      // 1. Остановка приема новых запросов
      bot.stop(signal);
      startupLogger.info('stopBot', LOG_MESSAGES.STARTUP.BOT_STOPPED);

      // 2. Завершение текущих задач (timeout 30 секунд)
      await Promise.race([
        schedulerService.close(),
        new Promise(resolve => setTimeout(resolve, 30000)),
      ]);
      startupLogger.info('closeScheduler', LOG_MESSAGES.STARTUP.SCHEDULER_CLOSED);

      // 3. Закрытие Redis соединения
      await redisClient.disconnect();
      startupLogger.info('disconnectRedis', LOG_MESSAGES.STARTUP.REDIS_DISCONNECTED);

      // 4. Закрытие БД соединений
      await prisma.$disconnect();
      startupLogger.info('disconnectDatabase', LOG_MESSAGES.STARTUP.DATABASE_DISCONNECTED);

      startupLogger.info('gracefulShutdown', LOG_MESSAGES.STARTUP.GRACEFUL_SHUTDOWN_COMPLETED);
      process.exit(0);

    } catch (error) {
      startupLogger.error('gracefulShutdown', LOG_MESSAGES.STARTUP.ERROR_DURING_GRACEFUL_SHUTDOWN, error as Error, {
          error: error instanceof Error ? error.message : error
      });
      process.exit(1);
    }
  };

  process.once('SIGINT', () => gracefulShutdown('SIGINT'));
  process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.once('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // nodemon совместимость
}

startApp().catch(error => {
  startupLogger.error('startApp', LOG_MESSAGES.STARTUP.UNHANDLED_ERROR_DURING_STARTUP, error as Error, {
      error: error instanceof Error ? error.message : error
  });
  process.exit(1);
});