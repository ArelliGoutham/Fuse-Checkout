import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config';

/**
 * Creates and configures a Fastify server instance.
 * Registers CORS plugin and health check route.
 * Routes and plugins are registered by the caller before listen().
 *
 * @returns Configured Fastify instance (not yet listening)
 */
export function createServer() {
  const server = Fastify({ logger: true });

  // CORS
  server.register(cors, { origin: true });

  // Health check
  server.get('/health', async () => ({
    status: 'ok',
    service: config.brandName,
    timestamp: new Date().toISOString(),
  }));

  return server;
}
