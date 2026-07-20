import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { MongoOrderRepository } from '../repositories/mongo-order-repository';

/**
 * Registers order management routes for a Fastify instance.
 * All endpoints require merchant authentication.
 *
 * @param server - Fastify instance (must have db decorator)
 */
export function registerOrderRoutes(server: FastifyInstance): void {
  /**
   * GET /api/orders - List orders for merchant with pagination
   */
  server.get<{ Querystring: { page?: string; limit?: string } }>(
    '/api/orders',
    { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const merchantId = request.merchantId;
      if (!merchantId) {
        return reply.code(401).send({
          error: { code: 'AUTH_INVALID', message: 'Missing merchant context' },
        });
      }

      // Parse query parameters
      const querystring = request.query as { page?: string; limit?: string };
      const page = parseInt(querystring.page || '1', 10);
      const limit = parseInt(querystring.limit || '10', 10);

      if (page < 1 || limit < 1 || limit > 100) {
        return reply.code(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid page or limit' },
        });
      }

      const db = server.db!;
      const repository = new MongoOrderRepository(db);

      try {
        const { orders, total } = await repository.findByMerchant(merchantId, page, limit);
        return reply.send({
          orders,
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        });
      } catch (error) {
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve orders' },
        });
      }
    }
  );

  /**
   * GET /api/orders/:id - Get a single order for merchant
   */
  server.get<{ Params: { id: string } }>(
    '/api/orders/:id',
    { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const merchantId = request.merchantId;
      if (!merchantId) {
        return reply.code(401).send({
          error: { code: 'AUTH_INVALID', message: 'Missing merchant context' },
        });
      }

      const { id } = request.params as { id: string };
      const db = server.db!;
      const repository = new MongoOrderRepository(db);

      try {
        const order = await repository.findById(id, merchantId);
        if (!order) {
          return reply.code(404).send({
            error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' },
          });
        }
        return reply.send(order);
      } catch (error) {
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve order' },
        });
      }
    }
  );
}
