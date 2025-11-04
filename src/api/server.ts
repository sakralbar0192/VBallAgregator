import Fastify from 'fastify';
import { healthRoutes } from './health-endpoint.js';
import { logger } from '../shared/logger.js';

export async function createServer() {
  const fastify = Fastify({
    logger: true,
    // Add basic configuration
    maxParamLength: 500,
  });

  // Register health check routes
  await fastify.register(healthRoutes);

  // Add root route
  fastify.get('/', async (request, reply) => {
    return {
      name: 'VBallAgregator API',
      version: '1.0.0',
      status: 'running',
      timestamp: new Date().toISOString()
    };
  });

  // Graceful shutdown
  const closeGracefully = async (signal: string) => {
    logger.info(`Received signal ${signal}, closing server gracefully`);
    await fastify.close();
    process.exit(0);
  };

  process.on('SIGINT', () => closeGracefully('SIGINT'));
  process.on('SIGTERM', () => closeGracefully('SIGTERM'));

  return fastify;
}

export async function startServer() {
  try {
    const server = await createServer();

    const address = await server.listen({
      host: '0.0.0.0',
      port: 3001, // Different port from bot
    });

    logger.info(`API server listening on ${address}`);

    return server;
  } catch (err) {
    logger.error('Failed to start API server', { error: err });
    process.exit(1);
  }
}