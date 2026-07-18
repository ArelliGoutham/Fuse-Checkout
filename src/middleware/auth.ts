import type { FastifyRequest, FastifyReply } from 'fastify';
import { getDatabase } from '../config/database';

declare module 'fastify' {
  interface FastifyRequest {
    merchantId?: string;
  }
}

/**
 * Creates an authentication middleware that validates API keys.
 * Extracts the API key from x-api-key header and looks it up in the merchants collection.
 * Sets request.merchantId if valid, returns 401 otherwise.
 *
 * @returns Middleware function for Fastify
 */
export function createAuthMiddleware() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const apiKey = request.headers['x-api-key'];
    if (!apiKey || typeof apiKey !== 'string') {
      return reply
        .code(401)
        .send({ error: { code: 'AUTH_INVALID', message: 'Missing x-api-key header' } });
    }

    const db = getDatabase();
    const merchant = await db.collection('merchants').findOne({ api_key_hash: apiKey });
    if (!merchant) {
      return reply.code(401).send({ error: { code: 'AUTH_INVALID', message: 'Invalid API key' } });
    }

    request.merchantId = (merchant._id as unknown as string).toString();
  };
}
