import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken } from '../lib/jwt';

/**
 * Creates JWT auth middleware that validates Authorization: Bearer <token>.
 * Sets request.user with the decoded token payload.
 */
export function createJwtAuthMiddleware() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ error: { code: 'AUTH_INVALID', message: 'Missing or invalid Authorization header' } });
    }

    const token = authHeader.slice(7);
    try {
      const payload = verifyToken(token);
      request.user = payload;
      request.merchantId = payload.merchant_id;
    } catch {
      return reply.code(401).send({ error: { code: 'AUTH_INVALID', message: 'Invalid or expired token' } });
    }
  };
}
