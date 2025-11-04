import 'dotenv/config';
import { validateConfig, config } from './src/shared/config.js';
import { bot } from './src/bot.js';
import { SchedulerService } from './src/shared/scheduler-service.js';
import { EventBus } from './src/shared/event-bus.js';
import { HealthCheckService } from './src/infrastructure/health.js';
import { registerEventHandlers } from './src/shared/event-handlers.js';
import { logger } from './src/shared/logger.js';
import { prisma } from './src/infrastructure/prisma.js';
import { createClient } from 'redis';

async function startApp() {
  try {
    // 1. Валидация конфигурации
    validateConfig(config);
    logger.info('Configuration validated');

    // 2. Инициализация сервисов
    const redisClient = createClient(config.redis);
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
    setupGracefulShutdown(schedulerService, redisClient);

  } catch (error) {
    logger.error('Failed to start application', { error: error instanceof Error ? error.message : error });
    process.exit(1);
  }
}

function setupGracefulShutdown(schedulerService: SchedulerService, redisClient: any) {
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

      // 3. Закрытие Redis соединения
      await redisClient.disconnect();
      logger.info('Redis disconnected');

      // 4. Закрытие БД соединений
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