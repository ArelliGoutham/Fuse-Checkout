import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { config } from './config';

/**
 * Creates and configures a Fastify server instance.
 * Registers CORS, rate-limit, and health check route.
 * Routes and plugins are registered by the caller before listen().
 *
 * @returns Configured Fastify instance (not yet listening)
 */
export async function createServer(): Promise<FastifyInstance> {
  const server = Fastify({ logger: true });

  // CORS
  await server.register(cors, { origin: true });

  // Register before callers declare routes so per-route limits attach correctly.
  await server.register(rateLimit, { global: false });

  // Health check
  server.get('/health', async () => ({
    status: 'ok',
    service: config.brandName,
    timestamp: new Date().toISOString(),
  }));

  return server;
}
