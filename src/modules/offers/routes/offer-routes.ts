import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { DiscountSchema } from '../schemas/discount';
import type { Offer, OfferRepository } from '../types';
import type { Rule } from '../schemas/offer';

declare module 'fastify' {
  interface FastifyInstance {
    offerRepository?: OfferRepository;
    db?: unknown;
  }
}

const CreateOfferSchema = z.object({
  code: z.string().nullable().optional(),
  type: z.enum(['coupon', 'auto_offer']),
  title: z.string(),
  description: z.string().optional(),
  discount: DiscountSchema,
  validity: z.object({
    starts_at: z.string().datetime(),
    ends_at: z.string().datetime(),
  }),
  usage_limits: z.object({
    total: z.number().int().positive().nullable(),
    per_customer: z.number().int().positive().nullable(),
  }),
  rules: z.array(z.object({
    rule_type: z.string(),
    config: z.record(z.string(), z.unknown()),
  })).default([]),
});

/**
 * Generates a unique offer ID.
 *
 * @returns Unique offer ID with format: offer_<timestamp>_<random>
 */
function generateOfferId(): string {
  const random = Math.random().toString(36).substring(2, 9);
  return `offer_${Date.now()}_${random}`;
}

/**
 * Registers offer CRUD routes for a Fastify instance.
 * Requires server to have offerRepository decorator set.
 *
 * @param server - Fastify instance
 */
export function registerOfferRoutes(server: FastifyInstance): void {
  /**
   * POST /api/offers - Create a new offer
   */
  server.post<{ Body: z.infer<typeof CreateOfferSchema> }>(
    '/api/offers',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const merchantId = request.merchantId;
      if (!merchantId) {
        return reply.code(401).send({ error: { code: 'AUTH_INVALID', message: 'Missing merchant context' } });
      }

      const parseResult = CreateOfferSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: parseResult.error.message } });
      }

      const now = new Date().toISOString();
      const offer: Offer = {
        _id: generateOfferId(),
        merchant_id: merchantId,
        code: parseResult.data.code || null,
        type: parseResult.data.type,
        title: parseResult.data.title,
        description: parseResult.data.description,
        discount: parseResult.data.discount,
        subsidy_model: 'merchant',
        status: 'active',
        validity: parseResult.data.validity,
        usage_limits: parseResult.data.usage_limits,
        usage_count: 0,
        rules: parseResult.data.rules as unknown as Rule[],
        stacking: { stacks_with: null, exclusive: false, priority: 0 },
        tags: [],
        created_at: now,
        updated_at: now,
      };

      const repository = server.offerRepository;
      if (!repository) {
        return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Offer repository not configured' } });
      }

      const saved = await repository.save(offer);
      return reply.code(201).send(saved);
    },
  );

  /**
   * GET /api/offers - List offers for the merchant
   */
  server.get('/api/offers', async (request: FastifyRequest, reply: FastifyReply) => {
    const merchantId = request.merchantId;
    if (!merchantId) {
      return reply.code(401).send({ error: { code: 'AUTH_INVALID', message: 'Missing merchant context' } });
    }

    const repository = server.offerRepository;
    if (!repository) {
      return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Offer repository not configured' } });
    }

    const offers = await repository.findByMerchant(merchantId);
    return reply.code(200).send({ offers });
  });

  /**
   * GET /api/offers/:id - Get a specific offer
   */
  server.get<{ Params: { id: string } }>(
    '/api/offers/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const merchantId = request.merchantId;
      if (!merchantId) {
        return reply.code(401).send({ error: { code: 'AUTH_INVALID', message: 'Missing merchant context' } });
      }

      const repository = server.offerRepository;
      if (!repository) {
        return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Offer repository not configured' } });
      }

      const offer = await repository.findById(request.params.id, merchantId);
      if (!offer) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Offer not found' } });
      }

      return reply.code(200).send(offer);
    },
  );

  /**
   * DELETE /api/offers/:id - Delete an offer
   */
  server.delete<{ Params: { id: string } }>(
    '/api/offers/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const merchantId = request.merchantId;
      if (!merchantId) {
        return reply.code(401).send({ error: { code: 'AUTH_INVALID', message: 'Missing merchant context' } });
      }

      const repository = server.offerRepository;
      if (!repository) {
        return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Offer repository not configured' } });
      }

      const deleted = await repository.delete(request.params.id, merchantId);
      if (!deleted) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Offer not found' } });
      }

      return reply.code(200).send({ deleted: true });
    },
  );
}
