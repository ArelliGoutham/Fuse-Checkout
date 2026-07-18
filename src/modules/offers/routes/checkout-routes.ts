import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { CartSchema } from '../schemas/cart';
import { CustomerContextSchema } from '../schemas/customer';
import type { Offer } from '../types';

const AvailableRequestSchema = z.object({
  cart: CartSchema,
  customer: CustomerContextSchema,
});

const ValidateRequestSchema = z.object({
  code: z.string().min(1),
  cart: CartSchema,
  customer: CustomerContextSchema,
});

const ApplyRequestSchema = z.object({
  code: z.string().min(1).optional(),
  offer_id: z.string().min(1).optional(),
  cart: CartSchema,
  customer: CustomerContextSchema,
  session_id: z.string().min(1),
});

/**
 * Registers checkout routes for offer evaluation and application.
 * Requires server to have offerService and db decorators set.
 *
 * @param server - Fastify instance
 */
export function registerCheckoutRoutes(server: FastifyInstance): void {
  /**
   * POST /api/offers/available - List available coupons and auto_offers with eligibility status
   */
  server.post<{ Body: z.infer<typeof AvailableRequestSchema> }>(
    '/api/offers/available',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const merchantId = request.merchantId;
      if (!merchantId) {
        return reply.code(401).send({ error: { code: 'AUTH_INVALID', message: 'Missing merchant context' } });
      }

      const parseResult = AvailableRequestSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: parseResult.error.message } });
      }

      const service = server.offerService;
      const db = server.db;
      if (!service || !db) {
        return reply
          .code(500)
          .send({ error: { code: 'INTERNAL_ERROR', message: 'Service not configured' } });
      }

      // Fetch merchant and all offers
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const merchant = await (db.collection('merchants') ).findOne({ _id: merchantId } as any);
      if (!merchant) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Merchant not found' } });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const offers = await (db.collection('offers') ).find({ merchant_id: merchantId, status: 'active' } as any).toArray();

      const { cart, customer } = parseResult.data;
      const now = new Date().toISOString();

      const context = {
        cart,
        customer,
        merchant: { stacking_policy: merchant.stacking_policy },
        usage: {
          per_customer_used: customer.per_customer_used,
          total_used: 0,
        },
        now,
      };

      // Evaluate all offers
      const evaluated = offers.map((offer: Record<string, unknown>) => {
        const result = service.evaluate(offer as unknown as Offer, context);
        return {
          ...offer,
          is_eligible: result.eligible,
          evaluation_result: result,
        };
      });

      const coupons = evaluated.filter((o) => (o as Record<string, unknown>).type === 'coupon');
      const auto_offers = evaluated.filter((o) => (o as Record<string, unknown>).type === 'auto_offer');

      return reply.code(200).send({ coupons, auto_offers });
    },
  );

  /**
   * POST /api/offers/validate - Validate a coupon code and return discount details
   */
  server.post<{ Body: z.infer<typeof ValidateRequestSchema> }>(
    '/api/offers/validate',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const merchantId = request.merchantId;
      if (!merchantId) {
        return reply.code(401).send({ error: { code: 'AUTH_INVALID', message: 'Missing merchant context' } });
      }

      const parseResult = ValidateRequestSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: parseResult.error.message } });
      }

      const service = server.offerService;
      const db = server.db;
      if (!service || !db) {
        return reply
          .code(500)
          .send({ error: { code: 'INTERNAL_ERROR', message: 'Service not configured' } });
      }

      // Find offer by code
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const offer = await (db.collection('offers') ).findOne({ code: parseResult.data.code, merchant_id: merchantId, status: 'active' } as any);

      if (!offer) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Offer not found' } });
      }

      // Fetch merchant and build context
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const merchant = await (db.collection('merchants') ).findOne({ _id: merchantId } as any);
      if (!merchant) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Merchant not found' } });
      }

      const { cart, customer } = parseResult.data;
      const now = new Date().toISOString();

      const context = {
        cart,
        customer,
        merchant: { stacking_policy: merchant.stacking_policy },
        usage: {
          per_customer_used: customer.per_customer_used,
          total_used: 0,
        },
        now,
      };

      // Evaluate offer
      const result = service.evaluate(offer as unknown as Offer, context);

      if (!result.eligible) {
        return reply.code(200).send({
          valid: false,
          reason: result.reason,
        });
      }

      // Calculate discount amount
      const discountAmount = result.discount?.amount ?? 0;
      const finalAmount = cart.amount - discountAmount;

      return reply.code(200).send({
        valid: true,
        offer,
        discount_amount: discountAmount,
        final_amount: finalAmount,
      });
    },
  );

  /**
   * POST /api/offers/apply - Apply an offer and create a redemption record
   */
  server.post<{ Body: z.infer<typeof ApplyRequestSchema> }>(
    '/api/offers/apply',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const merchantId = request.merchantId;
      if (!merchantId) {
        return reply.code(401).send({ error: { code: 'AUTH_INVALID', message: 'Missing merchant context' } });
      }

      const parseResult = ApplyRequestSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: parseResult.error.message } });
      }

      const service = server.offerService;
      const db = server.db;
      if (!service || !db) {
        return reply
          .code(500)
          .send({ error: { code: 'INTERNAL_ERROR', message: 'Service not configured' } });
      }

      // Find offer
      let offer;
      if (parseResult.data.code) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        offer = await (db.collection('offers') ).findOne({ code: parseResult.data.code, merchant_id: merchantId, status: 'active' } as any);
      } else if (parseResult.data.offer_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        offer = await (db.collection('offers') ).findOne({ _id: parseResult.data.offer_id, merchant_id: merchantId, status: 'active' } as any);
      }

      if (!offer) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Offer not found' } });
      }

      // Fetch merchant and build context
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const merchant = await (db.collection('merchants') ).findOne({ _id: merchantId } as any);
      if (!merchant) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Merchant not found' } });
      }

      const { cart, customer, session_id } = parseResult.data;
      const now = new Date().toISOString();

      const context = {
        cart,
        customer,
        merchant: { stacking_policy: merchant.stacking_policy },
        usage: {
          per_customer_used: customer.per_customer_used,
          total_used: 0,
        },
        now,
      };

      // Evaluate offer
      const result = service.evaluate(offer as unknown as Offer, context);

      if (!result.eligible) {
        return reply.code(400).send({
          applied: false,
          reason: result.reason,
        });
      }

      // Calculate discount amount
      const discountAmount = result.discount?.amount ?? 0;
      const finalAmount = cart.amount - discountAmount;

      // Create redemption record
      const redemption = {
        offer_id: offer._id,
        merchant_id: merchantId,
        session_id,
        cart_amount: cart.amount,
        discount_applied: discountAmount,
        final_amount: finalAmount,
        customer_id: customer.customer_id,
        applied_at: now,
        order_id: null,
        order_status: 'applied',
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db.collection('redemptions') ).insertOne(redemption as any);

      // Increment usage_count on offer
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db.collection('offers') ).updateOne({ _id: offer._id, merchant_id: merchantId } as any, { $inc: { usage_count: 1 } });

      return reply.code(200).send({
        applied: true,
        offer,
        discount_amount: discountAmount,
        final_amount: finalAmount,
      });
    },
  );
}
