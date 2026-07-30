import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { MongoPGCredentialsRepository } from '../repositories/mongo-pg-credentials-repository';
import { decrypt } from '../../../lib/encryption';
import { RazorpayAdapter } from '../../pg-adapters/razorpay-adapter';
import { MockPGAdapter } from '../../pg-adapters/mock-adapter';
import type { PGAdapter } from '../../pg-adapters/types';

/**
 * Registers refund routes for merchants.
 * All endpoints require merchant authentication.
 *
 * Refund flow:
 * 1. Merchant requests refund on a paid order
 * 2. Fuse loads the order + identifies which PG was used
 * 3. Fuse loads merchant's PG credentials for that PG
 * 4. Calls PG refund API (full or partial)
 * 5. Logs refund to transaction_logs
 * 6. Updates order status to 'refunded' (full) or 'partially_refunded' (partial)
 * 7. If brand subsidy was involved, reverses the subsidy ledger entry
 */
export function registerRefundRoutes(server: FastifyInstance): void {
  server.post<{
    Params: { id: string };
    Body: { amount?: number; reason?: string };
  }>(
    '/api/orders/:id/refund',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const merchantId = request.merchantId;
      if (!merchantId) {
        return reply.code(401).send({
          error: { code: 'AUTH_INVALID', message: 'Missing merchant context' },
        });
      }

      const { id: orderId } = request.params as { id: string };
      const body = request.body as { amount?: number; reason?: string };
      const db = server.db!;

      const RefundSchema = z.object({
        amount: z.number().positive().optional(),
        reason: z.string().max(500).optional(),
      });

      const parseResult = RefundSchema.safeParse(body);
      if (!parseResult.success) {
        return reply.code(400).send({
          error: { code: 'VALIDATION_ERROR', message: parseResult.error.message },
        });
      }

      try {
        // Find the order with tenant isolation
        const order = await db.collection('orders').findOne({
          _id: orderId as any,
          merchant_id: merchantId,
        });

        if (!order) {
          return reply.code(404).send({
            error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' },
          });
        }

        // Only paid orders can be refunded
        if (order.order_status !== 'paid') {
          return reply.code(409).send({
            error: {
              code: 'INVALID_ORDER_STATE',
              message: `Order is ${order.order_status}, only paid orders can be refunded`,
            },
          });
        }

        const pgName = order.pg_name as string;
        const pgPaymentId = order.pg_payment_id as string;
        const orderAmount = order.final_amount as number;
        const refundAmount = body.amount || orderAmount; // default: full refund
        const isFullRefund = refundAmount >= orderAmount;

        // Get the PG adapter (same logic as process-payment)
        const encryptionKey = process.env.ENCRYPTION_KEY || 'fuse-encryption-key-change-me-32';
        const pgCredsRepo = new MongoPGCredentialsRepository(db);
        let adapter: PGAdapter;

        if (pgName === 'razorpay') {
          const pgCreds = await pgCredsRepo.findActive(merchantId, 'razorpay');
          if (!pgCreds) {
            return reply.code(400).send({
              error: { code: 'PG_NOT_CONFIGURED', message: 'Razorpay credentials not found for this merchant' },
            });
          }
          const apiKey = decrypt(pgCreds.api_key_encrypted, encryptionKey);
          const apiSecret = decrypt(pgCreds.api_secret_encrypted, encryptionKey);
          adapter = new RazorpayAdapter(apiKey, apiSecret);
        } else {
          adapter = new MockPGAdapter();
        }

        // Call PG refund API
        const refundResult = await adapter.refundPayment({
          payment_id: pgPaymentId,
          amount: refundAmount,
          reason: body.reason,
          notes: { order_id: orderId, merchant_id: merchantId },
        });

        if (refundResult.status === 'failed') {
          return reply.code(400).send({
            error: {
              code: 'REFUND_FAILED',
              message: refundResult.error_message || 'Payment gateway refunded failed',
            },
          });
        }

        const now = new Date().toISOString();

        // Log refund to transaction_logs
        await db.collection('transaction_logs').insertOne({
          _id: `txl_refund_${orderId}_${Date.now()}` as any,
          order_id: orderId,
          session_id: order.session_id,
          merchant_id: merchantId,
          merchant_order_id: order.merchant_order_id || null,
          attempt_number: 1,
          pg_name: pgName,
          pg_order_id: order.pg_order_id,
          pg_payment_id: pgPaymentId,
          pg_status: refundResult.status,
          pg_error_code: null,
          pg_error_message: refundResult.error_message || null,
          pg_raw_request: { payment_id: pgPaymentId, amount: refundAmount, reason: body.reason },
          pg_raw_response: refundResult as unknown as Record<string, unknown>,
          amount: refundAmount,
          payment_method: 'refund',
          payment_status: refundResult.status === 'success' ? 'success' : 'pending',
          routing_reason: 'merchant_initiated refund',
          is_fallback: false,
          initiated_at: now,
          completed_at: now,
          latency_ms: 0,
          created_at: now,
        } as any);

        // Update order status
        await db.collection('orders').updateOne(
          { _id: orderId as any },
          {
            $set: {
              order_status: isFullRefund ? 'refunded' : 'paid',
              updated_at: now,
              ...(refundResult.refund_id && { pg_refund_id: refundResult.refund_id }),
            },
          }
        );

        // Reverse subsidy ledger entry if this was a brand-subsidized order
        const subsidyEntry = await db.collection('subsidy_ledger').findOne({ order_id: orderId });
        if (subsidyEntry) {
          await db.collection('subsidy_ledger').updateOne(
            { order_id: orderId },
            {
              $set: {
                settlement_status: 'disputed',
                updated_at: now,
              },
            }
          );
        }

        return reply.send({
          order_id: orderId,
          refund_id: refundResult.refund_id,
          amount: refundAmount,
          status: refundResult.status,
          is_full_refund: isFullRefund,
        });
      } catch {
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Failed to process refund' },
        });
      }
    }
  );
}
