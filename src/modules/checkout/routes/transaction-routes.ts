import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

/**
 * Registers transaction management routes for merchants.
 * All endpoints require merchant authentication (API key or JWT).
 *
 * Routes:
 * - GET /api/transactions — paginated list with filters
 * - GET /api/transactions/analytics — aggregate stats
 * - GET /api/transactions/:id — single transaction detail
 */
export function registerTransactionRoutes(server: FastifyInstance): void {
  /**
   * GET /api/transactions — List transactions with pagination + filters
   */
  server.get<{
    Querystring: {
      page?: string;
      limit?: string;
      status?: string;
      pg_name?: string;
      from?: string;
      to?: string;
    };
  }>(
    '/api/transactions',
    { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const merchantId = request.merchantId;
      if (!merchantId) {
        return reply.code(401).send({
          error: { code: 'AUTH_INVALID', message: 'Missing merchant context' },
        });
      }

      const query = request.query as {
        page?: string; limit?: string; status?: string;
        pg_name?: string; from?: string; to?: string;
      };

      const page = parseInt(query.page || '1', 10);
      const limit = parseInt(query.limit || '20', 10);

      if (page < 1 || limit < 1 || limit > 100) {
        return reply.code(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid page or limit' },
        });
      }

      const db = server.db!;
      const filter: Record<string, unknown> = { merchant_id: merchantId };

      if (query.status) {
        filter.payment_status = query.status;
      }
      if (query.pg_name) {
        filter.pg_name = query.pg_name;
      }
      if (query.from || query.to) {
        const dateFilter: Record<string, unknown> = {};
        if (query.from) dateFilter.$gte = query.from;
        if (query.to) dateFilter.$lte = query.to + 'T23:59:59.999Z';
        filter.initiated_at = dateFilter;
      }

      try {
        const skip = (page - 1) * limit;
        const [docs, total] = await Promise.all([
          db.collection('transaction_logs')
            .find(filter)
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(limit)
            .toArray(),
          db.collection('transaction_logs').countDocuments(filter),
        ]);

        return reply.send({
          transactions: docs,
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        });
      } catch {
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve transactions' },
        });
      }
    }
  );

  /**
   * GET /api/transactions/analytics — Aggregate stats for merchant
   */
  server.get<{
    Querystring: { from?: string; to?: string };
  }>(
    '/api/transactions/analytics',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const merchantId = request.merchantId;
      if (!merchantId) {
        return reply.code(401).send({
          error: { code: 'AUTH_INVALID', message: 'Missing merchant context' },
        });
      }

      const query = request.query as { from?: string; to?: string };
      const db = server.db!;

      const dateFilter: Record<string, unknown> = {};
      if (query.from) dateFilter.$gte = query.from;
      if (query.to) dateFilter.$lte = query.to + 'T23:59:59.999Z';

      const matchStage: Record<string, unknown> = { merchant_id: merchantId };
      if (Object.keys(dateFilter).length > 0) {
        matchStage.initiated_at = dateFilter;
      }

      try {
        // Overall stats
        const overall = await db.collection('transaction_logs').aggregate([
          { $match: matchStage },
          {
            $group: {
              _id: null,
              total_attempts: { $sum: 1 },
              successful: { $sum: { $cond: [{ $eq: ['$payment_status', 'success'] }, 1, 0] } },
              failed: { $sum: { $cond: [{ $eq: ['$payment_status', 'failed'] }, 1, 0] } },
              total_volume: {
                $sum: { $cond: [{ $eq: ['$payment_status', 'success'] }, '$amount', 0] },
              },
              avg_latency_ms: { $avg: '$latency_ms' },
            },
          },
        ]).toArray();

        const stats = overall[0] || {
          total_attempts: 0, successful: 0, failed: 0,
          total_volume: 0, avg_latency_ms: 0,
        };

        // Per-PG breakdown
        const pgBreakdown = await db.collection('transaction_logs').aggregate([
          { $match: matchStage },
          {
            $group: {
              _id: '$pg_name',
              attempts: { $sum: 1 },
              successful: { $sum: { $cond: [{ $eq: ['$payment_status', 'success'] }, 1, 0] } },
              volume: {
                $sum: { $cond: [{ $eq: ['$payment_status', 'success'] }, '$amount', 0] },
              },
              avg_latency: { $avg: '$latency_ms' },
            },
          },
          { $sort: { attempts: -1 } },
        ]).toArray();

        // Payment method breakdown
        const methodBreakdown = await db.collection('transaction_logs').aggregate([
          { $match: matchStage },
          {
            $group: {
              _id: '$payment_method',
              count: { $sum: 1 },
              successful: { $sum: { $cond: [{ $eq: ['$payment_status', 'success'] }, 1, 0] } },
            },
          },
        ]).toArray();

        const successRate = stats.total_attempts > 0
          ? Math.round((stats.successful / stats.total_attempts) * 10000) / 100
          : 0;
        const avgOrderValue = stats.successful > 0
          ? Math.round(stats.total_volume / stats.successful)
          : 0;

        return reply.send({
          total_attempts: stats.total_attempts,
          successful: stats.successful,
          failed: stats.failed,
          success_rate: successRate,
          total_volume: stats.total_volume,
          avg_order_value: avgOrderValue,
          avg_latency_ms: Math.round(stats.avg_latency_ms || 0),
          pg_breakdown: pgBreakdown.map(p => ({
            pg_name: p._id,
            attempts: p.attempts,
            successful: p.successful,
            success_rate: p.attempts > 0 ? Math.round((p.successful / p.attempts) * 10000) / 100 : 0,
            volume: p.volume,
            avg_latency_ms: Math.round(p.avg_latency || 0),
          })),
          payment_methods: methodBreakdown.map(m => ({
            method: m._id,
            count: m.count,
            success_rate: m.count > 0 ? Math.round((m.successful / m.count) * 10000) / 100 : 0,
          })),
        });
      } catch {
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve analytics' },
        });
      }
    }
  );

  /**
   * GET /api/transactions/:id — Single transaction detail
   */
  server.get<{ Params: { id: string } }>(
    '/api/transactions/:id',
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

      try {
        const tx = await db.collection('transaction_logs').findOne({
          _id: id as any,
          merchant_id: merchantId,
        });

        if (!tx) {
          return reply.code(404).send({
            error: { code: 'TRANSACTION_NOT_FOUND', message: 'Transaction not found' },
          });
        }

        return reply.send(tx);
      } catch {
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve transaction' },
        });
      }
    }
  );
}
