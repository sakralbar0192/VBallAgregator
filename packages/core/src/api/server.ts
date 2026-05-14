import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { healthRoutes } from './health-endpoint.js';
import { internalRoutes } from './internal-routes.js';
import { LoggerFactory } from '../shared/layer-logger.js';
import { LOG_MESSAGES } from '../shared/logging-messages.js';
import type { HealthCheckService } from '../infrastructure/health.js';

const logger = LoggerFactory.external('api-server');

export function getApiPort(): number {
  const raw = process.env.API_PORT ?? '3001';
  const p = parseInt(raw, 10);
  return Number.isFinite(p) && p > 0 ? p : 3001;
}

export async function createServer(options: {
  healthCheckService: HealthCheckService;
  prisma: PrismaClient;
}): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: true,
    maxParamLength: 500,
  });

  await fastify.register(healthRoutes, {
    healthCheckService: options.healthCheckService,
  });

  await fastify.register(internalRoutes, {
    prisma: options.prisma,
    internalApiToken: process.env.INTERNAL_API_TOKEN,
  });

  fastify.get('/', async () => ({
    name: 'VBallAgregator API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
  }));

  return fastify;
}

export async function startApiServer(options: {
  healthCheckService: HealthCheckService;
  prisma: PrismaClient;
}): Promise<FastifyInstance> {
  const server = await createServer(options);
  const port = getApiPort();

  const address = await server.listen({
    host: '0.0.0.0',
    port,
  });

  logger.info(
    'startApiServer',
    LOG_MESSAGES.INFRASTRUCTURE_SERVICES.API_SERVER_LISTENING.replace('{{address}}', address)
  );

  return server;
}
