import Fastify from 'fastify';
import { healthRoutes } from './health-endpoint.js';
import { LoggerFactory } from '../shared/layer-logger.js';
import { LOG_MESSAGES } from '../shared/logging-messages.js';

const logger = LoggerFactory.external('api-server');

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
    logger.info('closeGracefully', LOG_MESSAGES.INFRASTRUCTURE_SERVICES.API_SERVER_SIGNAL_RECEIVED.replace('{{signal}}', signal));
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

    logger.info('startServer', LOG_MESSAGES.INFRASTRUCTURE_SERVICES.API_SERVER_LISTENING.replace('{{address}}', address));

    return server;
  } catch (err) {
    logger.error('startServer', LOG_MESSAGES.INFRASTRUCTURE_SERVICES.API_SERVER_FAILED_TO_START, err as Error, { error: (err as Error).message });
    process.exit(1);
  }
}