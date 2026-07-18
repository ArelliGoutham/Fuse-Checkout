import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

/**
 * Registers analytics routes for a Fastify instance.
 * Requires server to have db decorator set and auth middleware.
 *
 * @param server - Fastify instance
 */
export function registerAnalyticsRoutes(server: FastifyInstance): void {
  /**
   * GET /api/analytics/overview - Get analytics overview
   */
  server.get(
    '/api/analytics/overview',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const merchantId = request.merchantId;
      if (!merchantId) {
        return reply.code(401).send({ error: { code: 'AUTH_INVALID', message: 'Missing merchant context' } });
      }

      const db = server.db;
      if (!db) {
        return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Database not available' } });
      }

      const redemptions = db.collection('redemptions');

      const result = await redemptions
        .aggregate([
          { $match: { merchant_id: merchantId } },
          {
            $group: {
              _id: null,
              total_redemptions: { $sum: 1 },
              conversions: {
                $sum: { $cond: [{ $eq: ['$order_status', 'paid'] }, 1, 0] },
              },
              abandoned: {
                $sum: { $cond: [{ $eq: ['$order_status', 'abandoned'] }, 1, 0] },
              },
              revenue_via_offers: { $sum: '$discount_applied' },
              total_discount_given: { $sum: '$discount_applied' },
            },
          },
        ])
        .toArray();

      if (!result || result.length === 0) {
        return reply.code(200).send({
          total_redemptions: 0,
          conversions: 0,
          abandoned: 0,
          conversion_rate: 0,
          revenue_via_offers: 0,
          total_discount_given: 0,
        });
      }

      const data = result[0];
      const conversionRate = data.total_redemptions > 0
        ? (data.conversions / data.total_redemptions) * 100
        : 0;

      return reply.code(200).send({
        total_redemptions: data.total_redemptions,
        conversions: data.conversions,
        abandoned: data.abandoned,
        conversion_rate: conversionRate,
        revenue_via_offers: data.revenue_via_offers,
        total_discount_given: data.total_discount_given,
      });
    },
  );

  /**
   * GET /api/analytics/offers - Get per-offer analytics
   */
  server.get(
    '/api/analytics/offers',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const merchantId = request.merchantId;
      if (!merchantId) {
        return reply.code(401).send({ error: { code: 'AUTH_INVALID', message: 'Missing merchant context' } });
      }

      const db = server.db;
      if (!db) {
        return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Database not available' } });
      }

      const redemptions = db.collection('redemptions');

      const result = await redemptions
        .aggregate([
          { $match: { merchant_id: merchantId } },
          {
            $group: {
              _id: '$offer_id',
              offer_id: { $first: '$offer_id' },
              redemptions: { $sum: 1 },
              conversions: {
                $sum: { $cond: [{ $eq: ['$order_status', 'paid'] }, 1, 0] },
              },
              revenue: { $sum: '$discount_applied' },
            },
          },
          { $sort: { redemptions: -1 } },
        ])
        .toArray();

      return reply.code(200).send({ offers: result || [] });
    },
  );
}
