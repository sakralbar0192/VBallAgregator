import { FastifyInstance } from 'fastify';
import { HealthCheckService } from '../infrastructure/health.js';

export interface HealthRoutesOptions {
  healthCheckService: HealthCheckService;
}

export async function healthRoutes(fastify: FastifyInstance, opts: HealthRoutesOptions) {
  const healthService = opts.healthCheckService;

  fastify.get('/health', async (_request, reply) => {
    const health = await healthService.checkHealth();

    const statusCode = health.status === 'healthy' ? 200
                      : health.status === 'degraded' ? 200
                      : 503;

    reply.code(statusCode).send(health);
  });

  fastify.get('/health/ready', async (_request, reply) => {
    const health = await healthService.checkHealth();
    const isReady = health.status !== 'unhealthy';

    reply.code(isReady ? 200 : 503).send({
      ready: isReady,
      timestamp: health.timestamp,
    });
  });

  fastify.get('/health/live', async (_request, reply) => {
    reply.send({ alive: true, timestamp: new Date().toISOString() });
  });
}
