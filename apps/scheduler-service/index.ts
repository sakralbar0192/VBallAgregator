import 'dotenv/config';
import { initTelemetry } from '../../packages/core/src/shared/telemetry.js';
import { EventBus } from '../../packages/core/src/shared/event-bus.js';
import { SchedulerService } from '../../packages/core/src/shared/scheduler-service.js';
import { config } from '../../packages/core/src/shared/config.js';
import { createClient } from 'redis';

/**
 * Отдельный процесс BullMQ workers (напоминания, priority-window).
 * Redis и переменные окружения — как у основного приложения; TELEGRAM_BOT_TOKEN не используется.
 */
async function main(): Promise<void> {
  initTelemetry();

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
  schedulerService.initializeWorkers();

  console.log('[scheduler-service] BullMQ workers running');

  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    console.log('[scheduler-service] shutdown', signal);
    await schedulerService.close().catch(() => undefined);
    await redisClient.disconnect().catch(() => undefined);
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch(err => {
  console.error('[scheduler-service]', err);
  process.exit(1);
});
