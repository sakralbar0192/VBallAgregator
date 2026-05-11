import 'dotenv/config';
import type { FastifyInstance } from 'fastify';
import { validateConfig, config } from './src/shared/config.js';
import { createBot } from './src/bot/create-bot.js';
import { SchedulerService } from './src/shared/scheduler-service.js';
import { EventBus } from './src/shared/event-bus.js';
import { HealthCheckService } from './src/infrastructure/health.js';
import { registerEventHandlers } from './src/shared/event-handlers.js';
import { startupLogger } from './src/shared/layer-logger.js';
import { LOG_MESSAGES } from './src/shared/logging-messages.js';
import { prisma } from './src/infrastructure/prisma.js';
import { createClient } from 'redis';
import { startApiServer } from './src/api/server.js';
import type { Telegraf } from 'telegraf';

/** Не логировать секрет токена из URL Telegram API в консоль */
function redactTelegramBotUrl(text: string): string {
  return text.replace(/bot\d+:[A-Za-z0-9_-]{10,}/g, 'bot<token>');
}

async function startApp() {
  let apiServer: FastifyInstance | undefined;
  const bot = await createBot();

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

    // 6. HTTP API (health, readiness)
    apiServer = await startApiServer({ healthCheckService: healthService });
    startupLogger.info('startApiServer', 'HTTP API listening');

    // 7. Запуск бота
    await bot.launch();
    startupLogger.info('launchBot', LOG_MESSAGES.STARTUP.BOT_STARTED_SUCCESSFULLY);

    // 8. Настройка graceful shutdown
    setupGracefulShutdown(schedulerService, redisClient, apiServer, bot);

  } catch (error: unknown) {
    const err =
      error instanceof Error
        ? error
        : new Error(typeof error === 'string' ? error : JSON.stringify(error));
    const logErr = new Error(redactTelegramBotUrl(err.message));
    logErr.name = err.name;
    logErr.stack = err.stack ? redactTelegramBotUrl(err.stack) : undefined;
    startupLogger.error('startApp', LOG_MESSAGES.STARTUP.FAILED_TO_START_APPLICATION, logErr, {
      message: logErr.message,
    });
    console.error('\n[startup] Ошибка запуска:', redactTelegramBotUrl(err.message));
    const safeStack = err.stack ? redactTelegramBotUrl(err.stack) : '';
    if (safeStack) console.error(safeStack);
    if (apiServer) {
      try {
        await apiServer.close();
      } catch {
        /* ignore */
      }
    }
    process.exit(1);
  }
}

function setupGracefulShutdown(
  schedulerService: SchedulerService,
  redisClient: { disconnect: () => Promise<void> },
  apiServer: FastifyInstance | undefined,
  bot: Telegraf
) {
  const gracefulShutdown = async (signal: string) => {
    startupLogger.info('gracefulShutdown', LOG_MESSAGES.STARTUP.GRACEFUL_SHUTDOWN_INITIATED, { signal });

    try {
      // 1. Закрытие HTTP до остановки бота
      if (apiServer) {
        await apiServer.close();
        startupLogger.info('closeApiServer', 'HTTP API stopped');
      }

      // 2. Остановка приема сообщений ботом
      bot.stop(signal);
      startupLogger.info('stopBot', LOG_MESSAGES.STARTUP.BOT_STOPPED);

      // 3. Завершение текущих задач (timeout 30 секунд)
      await Promise.race([
        schedulerService.close(),
        new Promise(resolve => setTimeout(resolve, 30000)),
      ]);
      startupLogger.info('closeScheduler', LOG_MESSAGES.STARTUP.SCHEDULER_CLOSED);

      // 4. Закрытие Redis соединения
      await redisClient.disconnect();
      startupLogger.info('disconnectRedis', LOG_MESSAGES.STARTUP.REDIS_DISCONNECTED);

      // 5. Закрытие БД соединений
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
