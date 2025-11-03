import { FastifyInstance } from 'fastify';
import { HealthCheckService } from '../infrastructure/health.js';
import { prisma } from '../infrastructure/prisma.js';
import { createClient } from 'redis';
import { SchedulerService } from '../shared/scheduler-service.js';
import { EventBus } from '../shared/event-bus.js';
import { config } from '../shared/config.js';

// Initialize services for health checks
const redisClient = createClient(config.redis);
const eventBus = new EventBus();
const schedulerService = new SchedulerService(eventBus);
const healthService = new HealthCheckService(prisma, redisClient, schedulerService);

export async function healthRoutes(fastify: FastifyInstance) {
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