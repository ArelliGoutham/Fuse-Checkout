import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { CreateBankRateSchema, BankRateSchema } from '../schemas/bank-rate';
import type { BankRate } from '../schemas/bank-rate';

/**
 * Registers bank rate management routes for a Fastify instance.
 * All endpoints require authentication.
 *
 * @param server - Fastify instance (must have db decorator)
 */
export function registerBankRateRoutes(server: FastifyInstance): void {
  /**
   * GET /api/admin/bank-rates - List all active bank rates
   */
  server.get(
    '/api/admin/bank-rates',
    { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.userId;
      if (!userId) {
        return reply.code(401).send({
          error: { code: 'AUTH_INVALID', message: 'Missing authentication' },
        });
      }

      const db = server.db;

      try {
        const bankRates = await db
          .collection('bank_rates')
          .find({ status: 'active' })
          .toArray();

        const parsed = bankRates.map((rate) => BankRateSchema.parse(rate));
        return reply.send({ bank_rates: parsed });
      } catch (error) {
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve bank rates' },
        });
      }
    }
  );

  /**
   * POST /api/admin/bank-rates - Create a new bank rate
   */
  server.post<{ Body: z.infer<typeof CreateBankRateSchema> }>(
    '/api/admin/bank-rates',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.userId;
      if (!userId) {
        return reply.code(401).send({
          error: { code: 'AUTH_INVALID', message: 'Missing authentication' },
        });
      }

      const parseResult = CreateBankRateSchema.safeParse(request.body as Record<string, unknown>);
      if (!parseResult.success) {
        return reply.code(400).send({
          error: { code: 'VALIDATION_ERROR', message: parseResult.error.message },
        });
      }

      const db = server.db;
      const now = new Date().toISOString();
      const id = `br_${parseResult.data.bank_code.toLowerCase()}_${parseResult.data.card_type}`;

      const bankRate: BankRate = {
        _id: id,
        bank_name: parseResult.data.bank_name,
        bank_code: parseResult.data.bank_code,
        card_type: parseResult.data.card_type,
        interest_rate: parseResult.data.interest_rate,
        tenures: parseResult.data.tenures,
        processing_fee: parseResult.data.processing_fee,
        min_amount: parseResult.data.min_amount,
        max_amount: parseResult.data.max_amount,
        status: 'active',
        updated_at: now,
      };

      try {
        await db.collection('bank_rates').insertOne(bankRate as any);
        return reply.code(201).send(bankRate);
      } catch (error: any) {
        if (error.code === 11000) {
          return reply.code(409).send({
            error: { code: 'DUPLICATE_BANK_RATE', message: 'Bank rate already exists' },
          });
        }
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Failed to create bank rate' },
        });
      }
    }
  );

  /**
   * PATCH /api/admin/bank-rates/:id - Update a bank rate
   */
  server.patch<{
    Params: { id: string };
    Body: Partial<z.infer<typeof CreateBankRateSchema>>;
  }>(
    '/api/admin/bank-rates/:id',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.userId;
      if (!userId) {
        return reply.code(401).send({
          error: { code: 'AUTH_INVALID', message: 'Missing authentication' },
        });
      }

      const { id } = request.params;
      const db = server.db;

      // Validate allowed update fields
      const UpdateSchema = z.object({
        interest_rate: z.number().positive().optional(),
        tenures: z.array(z.number().int().positive()).optional(),
        processing_fee: z.number().nullable().optional(),
        min_amount: z.number().positive().optional(),
        max_amount: z.number().nullable().optional(),
      });

      const parseResult = UpdateSchema.safeParse(request.body as Record<string, unknown>);
      if (!parseResult.success) {
        return reply.code(400).send({
          error: { code: 'VALIDATION_ERROR', message: parseResult.error.message },
        });
      }

      try {
        const updateData: Record<string, unknown> = {
          ...parseResult.data,
          updated_at: new Date().toISOString(),
        };

        const result = await db.collection('bank_rates').findOneAndUpdate(
          { _id: id as any },
          { $set: updateData },
          { returnDocument: 'after' }
        );

        if (!result) {
          return reply.code(404).send({
            error: { code: 'BANK_RATE_NOT_FOUND', message: 'Bank rate not found' },
          });
        }

        const parsed = BankRateSchema.parse(result);
        return reply.send(parsed);
      } catch (error) {
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Failed to update bank rate' },
        });
      }
    }
  );
}
