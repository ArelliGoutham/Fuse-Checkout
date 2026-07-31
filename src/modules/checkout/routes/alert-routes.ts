import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

/**
 * Registers PG alert and health monitoring routes.
 * All endpoints require merchant authentication.
 */
export function registerAlertRoutes(server: FastifyInstance): void {
  /**
   * GET /api/admin/alerts — List alerts for merchant
   */
  server.get<{
    Querystring: { status?: string; severity?: string; page?: string; limit?: string };
  }>(
    '/api/admin/alerts',
    { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const merchantId = request.merchantId;
      if (!merchantId) {
        return reply.code(401).send({
          error: { code: 'AUTH_INVALID', message: 'Missing merchant context' },
        });
      }

      const query = request.query as {
        status?: string; severity?: string; page?: string; limit?: string;
      };
      const page = parseInt(query.page || '1', 10);
      const limit = parseInt(query.limit || '20', 10);
      const db = server.db!;

      const filter: Record<string, unknown> = { merchant_id: merchantId };
      if (query.status) filter.status = query.status;
      if (query.severity) filter.severity = query.severity;

      const skip = (page - 1) * limit;
      try {
        const [docs, total] = await Promise.all([
          db.collection('pg_alerts')
            .find(filter)
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(limit)
            .toArray(),
          db.collection('pg_alerts').countDocuments(filter),
        ]);

        return reply.send({
          alerts: docs,
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        });
      } catch {
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve alerts' },
        });
      }
    }
  );

  /**
   * POST /api/admin/alerts/:id/dismiss — Dismiss an alert
   */
  server.post<{ Params: { id: string } }>(
    '/api/admin/alerts/:id/dismiss',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const merchantId = request.merchantId;
      if (!merchantId) {
        return reply.code(401).send({
          error: { code: 'AUTH_INVALID', message: 'Missing merchant context' },
        });
      }

      const { id } = request.params as { id: string };
      const db = server.db!;
      const now = new Date().toISOString();

      try {
        const result = await db.collection('pg_alerts').updateOne(
          { _id: id as any, merchant_id: merchantId, status: 'active' },
          {
            $set: {
              status: 'dismissed',
              dismissed_at: now,
              dismissed_by: merchantId,
            },
          }
        );

        if (result.matchedCount === 0) {
          return reply.code(404).send({
            error: { code: 'ALERT_NOT_FOUND', message: 'Active alert not found' },
          });
        }

        return reply.send({ dismissed: true, id });
      } catch {
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Failed to dismiss alert' },
        });
      }
    }
  );

  /**
   * GET /api/admin/pg-health — PG health overview for merchant
   */
  server.get(
    '/api/admin/pg-health',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const merchantId = request.merchantId;
      if (!merchantId) {
        return reply.code(401).send({
          error: { code: 'AUTH_INVALID', message: 'Missing merchant context' },
        });
      }

      const db = server.db!;
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
      const twentyFourHourAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

      try {
        // Active alerts count
        const activeAlerts = await db.collection('pg_alerts').countDocuments({
          merchant_id: merchantId,
          status: 'active',
        });

        // Active alerts by severity
        const alertsBySeverity = await db.collection('pg_alerts').aggregate([
          { $match: { merchant_id: merchantId, status: 'active' } },
          { $group: { _id: '$severity', count: { $sum: 1 } } },
        ]).toArray();

        // PG performance in last 1 hour
        const pgPerformance = await db.collection('transaction_logs').aggregate([
          { $match: { merchant_id: merchantId, initiated_at: { $gte: oneHourAgo } } },
          {
            $group: {
              _id: '$pg_name',
              total_attempts: { $sum: 1 },
              successful: { $sum: { $cond: [{ $eq: ['$payment_status', 'success'] }, 1, 0] } },
              failed: { $sum: { $cond: [{ $eq: ['$payment_status', 'failed'] }, 1, 0] } },
              avg_latency_ms: { $avg: '$latency_ms' },
            },
          },
        ]).toArray();

        // PG performance in last 24 hours (for trend)
        const pgPerformance24h = await db.collection('transaction_logs').aggregate([
          { $match: { merchant_id: merchantId, initiated_at: { $gte: twentyFourHourAgo } } },
          {
            $group: {
              _id: '$pg_name',
              total_attempts: { $sum: 1 },
              successful: { $sum: { $cond: [{ $eq: ['$payment_status', 'success'] }, 1, 0] } },
            },
          },
        ]).toArray();

        const pgHealth = pgPerformance.map((p: any) => {
          const perf24h = pgPerformance24h.find((p24: any) => p24._id === p._id);
          const successRate = p.total_attempts > 0 ? Math.round((p.successful / p.total_attempts) * 10000) / 100 : 100;
          const successRate24h = perf24h && perf24h.total_attempts > 0
            ? Math.round((perf24h.successful / perf24h.total_attempts) * 10000) / 100
            : 100;

          return {
            pg_name: p._id,
            total_attempts_1h: p.total_attempts,
            successful_1h: p.successful,
            failed_1h: p.failed,
            success_rate_1h: successRate,
            success_rate_24h: successRate24h,
            avg_latency_ms_1h: Math.round(p.avg_latency_ms || 0),
            trend: successRate > successRate24h + 5 ? 'improving' :
                   successRate < successRate24h - 5 ? 'declining' : 'stable',
            status: successRate >= 90 ? 'healthy' :
                    successRate >= 70 ? 'degraded' : 'critical',
          };
        });

        return reply.send({
          active_alerts: activeAlerts,
          alerts_by_severity: alertsBySeverity.reduce((acc: Record<string, number>, a: any) => {
            acc[a._id] = a.count;
            return acc;
          }, {}),
          pg_health: pgHealth,
        });
      } catch {
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve PG health' },
        });
      }
    }
  );
}
