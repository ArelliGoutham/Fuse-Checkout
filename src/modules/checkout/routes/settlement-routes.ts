import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { SubsidySettlementEngine } from '../services/subsidy-settlement-engine';
import { validateIMEI } from '../../../lib/imei';

/**
 * Registers subsidy settlement routes for merchants.
 * All endpoints require merchant authentication.
 */
export function registerSettlementRoutes(server: FastifyInstance): void {
  /**
   * GET /api/subsidy/ledger — List subsidy ledger entries for merchant
   */
  server.get<{
    Querystring: { status?: string; page?: string; limit?: string };
  }>(
    '/api/subsidy/ledger',
    { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const merchantId = request.merchantId;
      if (!merchantId) {
        return reply.code(401).send({
          error: { code: 'AUTH_INVALID', message: 'Missing merchant context' },
        });
      }

      const query = request.query as { status?: string; page?: string; limit?: string };
      const page = parseInt(query.page || '1', 10);
      const limit = parseInt(query.limit || '20', 10);
      const engine = new SubsidySettlementEngine(server.db!);

      try {
        const { entries, total } = await engine.listByMerchant(merchantId, query.status, page, limit);
        return reply.send({
          entries,
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        });
      } catch {
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve subsidy ledger' },
        });
      }
    }
  );

  /**
   * GET /api/subsidy/reconciliation — Reconciliation summary by brand
   */
  server.get(
    '/api/subsidy/reconciliation',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const merchantId = request.merchantId;
      if (!merchantId) {
        return reply.code(401).send({
          error: { code: 'AUTH_INVALID', message: 'Missing merchant context' },
        });
      }

      const engine = new SubsidySettlementEngine(server.db!);

      try {
        const summary = await engine.getReconciliationSummary(merchantId);
        return reply.send(summary);
      } catch {
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Failed to generate reconciliation report' },
        });
      }
    }
  );

  /**
   * POST /api/subsidy/:order_id/imei — Capture IMEI for a brand-subsidized order
   */
  server.post<{
    Params: { order_id: string };
    Body: { imei: string };
  }>(
    '/api/subsidy/:order_id/imei',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const merchantId = request.merchantId;
      if (!merchantId) {
        return reply.code(401).send({
          error: { code: 'AUTH_INVALID', message: 'Missing merchant context' },
        });
      }

      const { order_id } = request.params as { order_id: string };
      const body = request.body as { imei?: string };

      if (!body.imei) {
        return reply.code(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'IMEI is required' },
        });
      }

      const validation = validateIMEI(body.imei);
      if (!validation.valid) {
        return reply.code(400).send({
          error: { code: 'INVALID_IMEI', message: validation.error },
        });
      }

      const engine = new SubsidySettlementEngine(server.db!);

      try {
        const result = await engine.captureIMEI(order_id, body.imei);
        if (!result.success) {
          return reply.code(404).send({
            error: { code: 'LEDGER_NOT_FOUND', message: result.error },
          });
        }
        return reply.send({ captured: true, imei: validation.sanitized });
      } catch {
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Failed to capture IMEI' },
        });
      }
    }
  );

  /**
   * POST /api/subsidy/:order_id/settle — Mark subsidy as settled by brand
   */
  server.post<{
    Params: { order_id: string };
    Body: { settlement_ref: string };
  }>(
    '/api/subsidy/:order_id/settle',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const merchantId = request.merchantId;
      if (!merchantId) {
        return reply.code(401).send({
          error: { code: 'AUTH_INVALID', message: 'Missing merchant context' },
        });
      }

      const { order_id } = request.params as { order_id: string };
      const body = request.body as { settlement_ref?: string };

      if (!body.settlement_ref) {
        return reply.code(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'settlement_ref is required' },
        });
      }

      const engine = new SubsidySettlementEngine(server.db!);

      try {
        const result = await engine.markSettled(order_id, body.settlement_ref);
        if (!result.success) {
          return reply.code(409).send({
            error: { code: 'INVALID_STATE', message: result.error },
          });
        }
        return reply.send({ settled: true, order_id });
      } catch {
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Failed to mark as settled' },
        });
      }
    }
  );

  /**
   * POST /api/subsidy/:order_id/paid — Mark subsidy as paid to merchant
   */
  server.post<{ Params: { order_id: string } }>(
    '/api/subsidy/:order_id/paid',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const merchantId = request.merchantId;
      if (!merchantId) {
        return reply.code(401).send({
          error: { code: 'AUTH_INVALID', message: 'Missing merchant context' },
        });
      }

      const { order_id } = request.params as { order_id: string };
      const engine = new SubsidySettlementEngine(server.db!);

      try {
        const result = await engine.markPaid(order_id);
        if (!result.success) {
          return reply.code(409).send({
            error: { code: 'INVALID_STATE', message: result.error },
          });
        }
        return reply.send({ paid: true, order_id });
      } catch {
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Failed to mark as paid' },
        });
      }
    }
  );
}
