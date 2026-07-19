import type { FastifyRequest, FastifyReply } from 'fastify';
import { ROLE_LEVELS, type Role } from '../modules/auth/schemas/invite';

/**
 * Creates middleware that checks if the authenticated user has the required role level.
 * Must be used after JWT auth middleware (requires request.user to be set).
 *
 * @param minRole - The minimum role required to access the endpoint
 */
export function requireRole(minRole: Role) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.code(401).send({ error: { code: 'AUTH_INVALID', message: 'Not authenticated' } });
    }

    const userLevel = ROLE_LEVELS[request.user.role as Role] ?? 0;
    const requiredLevel = ROLE_LEVELS[minRole];

    if (userLevel < requiredLevel) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
    }
  };
}
