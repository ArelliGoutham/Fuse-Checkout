import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { PGWebhookVerifier } from '../../pg-adapters/types';
import { MongoPGCredentialsRepository } from '../repositories/mongo-pg-credentials-repository';
import { decrypt } from '../../../lib/encryption';
import { MongoSessionRepository } from '../repositories/mongo-session-repository';

/**
 * Registers a generic PG webhook handler that uses a PGWebhookVerifier to validate signatures.
 * This follows dependency inversion — the route depends on the interface, not the concrete adapter.
 *
 * @param server - Fastify instance
 * @param verifier - PGWebhookVerifier implementation (e.g., RazorpayAdapter instance)
 * @param pgName - Name of the PG (e.g., "razorpay")
 */
export function registerPGWebhook(
  server: FastifyInstance,
  verifier: PGWebhookVerifier,
  pgName: string
): void {
  server.post(
    `/api/webhooks/${pgName}`,
    { config: { rateLimit: { max: 300, timeWindow: '1 minute' } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const rawBody = JSON.stringify(request.body);
      const signatureHeader = request.headers[`x-${pgName}-signature`] as string;

      if (!signatureHeader) {
        return reply.code(400).send({
          error: { code: 'INVALID_WEBHOOK', message: `Missing X-${pgName}-Signature header` },
        });
      }

      const payload = request.body as Record<string, unknown>;
      const eventType = payload.event as string;
      const paymentEntity = (payload.payload as Record<string, unknown>)?.payment as Record<string, unknown> | undefined;

      if (!paymentEntity) {
        return reply.code(400).send({
          error: { code: 'INVALID_WEBHOOK', message: 'Missing payment entity in webhook' },
        });
      }

      const pgOrderId = paymentEntity.order_id as string;
      const pgPaymentId = paymentEntity.id as string;
      const paymentStatus = paymentEntity.status as string;

      const db = server.db!;
      const sessionRepo = new MongoSessionRepository(db);

      // Find order by pg_order_id across all merchants
      const order = await db.collection('orders').findOne({ pg_order_id: pgOrderId });

      if (!order) {
        await db.collection('webhook_logs').insertOne({
          pg_name: pgName,
          event: eventType,
          order_id: pgOrderId,
          payment_id: pgPaymentId,
          status: 'order_not_found',
          raw_body: payload,
          received_at: new Date().toISOString(),
        });
        return reply.code(200).send({ received: true, matched: false });
      }

      const merchantId = order.merchant_id as string;

      // Fetch merchant's webhook secret to verify signature
      const pgCredsRepo = new MongoPGCredentialsRepository(db);
      const creds = await pgCredsRepo.findActive(merchantId, pgName);

      if (!creds || !creds.webhook_secret_encrypted) {
        await db.collection('webhook_logs').insertOne({
          pg_name: pgName,
          event: eventType,
          order_id: pgOrderId,
          merchant_id: merchantId,
          status: 'no_webhook_secret',
          raw_body: payload,
          received_at: new Date().toISOString(),
        });
        return reply.code(200).send({ received: true, verified: false });
      }

      const encryptionKey = process.env.ENCRYPTION_KEY || 'fuse-encryption-key-change-me-32';
      const webhookSecret = decrypt(creds.webhook_secret_encrypted, encryptionKey);

      // Verify webhook signature using the injected verifier (interface, not concrete class)
      const isValid = verifier.verifyWebhook(rawBody, signatureHeader, webhookSecret);

      if (!isValid) {
        await db.collection('webhook_logs').insertOne({
          pg_name: pgName,
          event: eventType,
          order_id: pgOrderId,
          merchant_id: merchantId,
          status: 'signature_invalid',
          raw_body: payload,
          received_at: new Date().toISOString(),
        });
        return reply.code(401).send({
          error: { code: 'INVALID_SIGNATURE', message: 'Webhook signature verification failed' },
        });
      }

      // Update order based on payment status
      if (
        paymentStatus === 'captured' &&
        (order.order_status === 'created' || order.order_status === 'failed')
      ) {
        await db.collection('orders').updateOne(
          { _id: order._id },
          {
            $set: {
              order_status: 'paid',
              pg_payment_id: pgPaymentId,
              paid_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          }
        );

        await sessionRepo.updatePaymentStatus(
          order.session_id as string,
          'success',
          pgPaymentId,
          order._id as unknown as string
        );
      } else if (paymentStatus === 'failed') {
        await db.collection('orders').updateOne(
          { _id: order._id },
          {
            $set: {
              order_status: 'failed',
              updated_at: new Date().toISOString(),
            },
          }
        );

        await sessionRepo.updatePaymentStatus(
          order.session_id as string,
          'failed',
          pgPaymentId,
          order._id as unknown as string
        );
      }

      // Log webhook for audit
      await db.collection('webhook_logs').insertOne({
        pg_name: pgName,
        event: eventType,
        order_id: pgOrderId,
        payment_id: pgPaymentId,
        merchant_id: merchantId,
        status: paymentStatus,
        verified: true,
        raw_body: payload,
        received_at: new Date().toISOString(),
      });

      return reply.code(200).send({ received: true, verified: true, status: paymentStatus });
    }
  );
}
