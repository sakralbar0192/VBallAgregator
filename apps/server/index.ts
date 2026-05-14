import 'dotenv/config';
import type { FastifyInstance } from 'fastify';
import { initTelemetry } from '../../packages/core/src/shared/telemetry.js';
import { validateConfig, config } from '../../packages/core/src/shared/config.js';
import { createBot } from '../../packages/bot-volley/src/bot/create-bot.js';
import { ApplicationServiceFactory } from '../../packages/core/src/application/services/application-service-factory.js';
import { EventBus } from '../../packages/core/src/shared/event-bus.js';
import { HealthCheckService } from '../../packages/core/src/infrastructure/health.js';
import { registerEventHandlers } from '../../packages/core/src/shared/event-handlers.js';
import { startupLogger } from '../../packages/core/src/shared/layer-logger.js';
import { LOG_MESSAGES } from '../../packages/core/src/shared/logging-messages.js';
import { prisma } from '../../packages/core/src/infrastructure/prisma.js';
import { createClient } from 'redis';
import { startApiServer } from '../../packages/core/src/api/server.js';
import type { Telegraf } from 'telegraf';
import type { SchedulerService } from '../../packages/core/src/shared/scheduler-service.js';

/** Не логировать секрет токена из URL Telegram API в консоль */
function redactTelegramBotUrl(text: string): string {
  return text.replace(/bot\d+:[A-Za-z0-9_-]{10,}/g, 'bot<token>');
}

async function startApp() {
  let apiServer: FastifyInstance | undefined;

  try {
    initTelemetry();
    validateConfig(config);
    startupLogger.info('validateConfig', LOG_MESSAGES.STARTUP.CONFIG_VALIDATED);

    const redisClient = createClient({
      socket: {
        host: config.redis.host,
        port: config.redis.port,
      },
      password: config.redis.password,
    });
    await redisClient.connect();

    const bot = await createBot({ sessionRedis: redisClient as never });

    const eventBus = EventBus.getInstance();
    const schedulerService = ApplicationServiceFactory.getInstance().getSchedulerService();
    const healthService = new HealthCheckService(
      prisma,
      redisClient,
      schedulerService
    );

    await registerEventHandlers(eventBus);
    startupLogger.info('registerEventHandlers', LOG_MESSAGES.STARTUP.EVENT_HANDLERS_REGISTERED);

    const health = await healthService.checkHealth();
    if (health.status === 'unhealthy') {
      throw new Error(`System unhealthy: ${JSON.stringify(health.checks)}`);
    }
    startupLogger.info('checkHealth', LOG_MESSAGES.STARTUP.HEALTH_CHECK_PASSED, { status: health.status });

    apiServer = await startApiServer({ healthCheckService: healthService, prisma });
    startupLogger.info('startApiServer', 'HTTP API listening');

    await bot.launch();
    startupLogger.info('launchBot', LOG_MESSAGES.STARTUP.BOT_STARTED_SUCCESSFULLY);

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
      if (apiServer) {
        await apiServer.close();
        startupLogger.info('closeApiServer', 'HTTP API stopped');
      }

      bot.stop(signal);
      startupLogger.info('stopBot', LOG_MESSAGES.STARTUP.BOT_STOPPED);

      await Promise.race([
        schedulerService.close(),
        new Promise(resolve => setTimeout(resolve, 30000)),
      ]);
      startupLogger.info('closeScheduler', LOG_MESSAGES.STARTUP.SCHEDULER_CLOSED);

      await redisClient.disconnect();
      startupLogger.info('disconnectRedis', LOG_MESSAGES.STARTUP.REDIS_DISCONNECTED);

      await prisma.$disconnect();
      startupLogger.info('disconnectDatabase', LOG_MESSAGES.STARTUP.DATABASE_DISCONNECTED);

      startupLogger.info('gracefulShutdown', LOG_MESSAGES.STARTUP.GRACEFUL_SHUTDOWN_COMPLETED);
      process.exit(0);
    } catch (error) {
      startupLogger.error('gracefulShutdown', LOG_MESSAGES.STARTUP.ERROR_DURING_GRACEFUL_SHUTDOWN, error as Error, {
        error: error instanceof Error ? error.message : error,
      });
      process.exit(1);
    }
  };

  process.once('SIGINT', () => gracefulShutdown('SIGINT'));
  process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.once('SIGUSR2', () => gracefulShutdown('SIGUSR2'));
}

startApp().catch(error => {
  startupLogger.error('startApp', LOG_MESSAGES.STARTUP.UNHANDLED_ERROR_DURING_STARTUP, error as Error, {
    error: error instanceof Error ? error.message : error,
  });
  process.exit(1);
});
