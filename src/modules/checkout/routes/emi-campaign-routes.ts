import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { CreateEMICampaignSchema, EMICampaignSchema } from '../schemas/emi-campaign';
import type { EMICampaign } from '../schemas/emi-campaign';

export function registerEMICampaignRoutes(server: FastifyInstance): void {
  server.get('/api/admin/emi-campaigns', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    if (!user) return reply.code(401).send({ error: { code: 'AUTH_INVALID', message: 'Missing authentication' } });
    try {
      const campaigns = await server.db!.collection('emi_campaigns').find({}).toArray();
      return reply.send({ campaigns: campaigns.map((c: unknown) => EMICampaignSchema.parse(c)) });
    } catch { return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve EMI campaigns' } }); }
  });

  server.post<{ Body: z.infer<typeof CreateEMICampaignSchema> }>('/api/admin/emi-campaigns', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    if (!user) return reply.code(401).send({ error: { code: 'AUTH_INVALID', message: 'Missing authentication' } });
    const parseResult = CreateEMICampaignSchema.safeParse(request.body as Record<string, unknown>);
    if (!parseResult.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: parseResult.error.message } });
    const now = new Date().toISOString();
    const id = 'camp_' + parseResult.data.code.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const campaign: EMICampaign = { _id: id, ...parseResult.data, status: 'active', created_at: now, updated_at: now };
    try {
      await server.db!.collection('emi_campaigns').insertOne(campaign as any);
      return reply.code(201).send(campaign);
    } catch (error: any) {
      if (error.code === 11000) return reply.code(409).send({ error: { code: 'DUPLICATE_CAMPAIGN', message: 'EMI campaign already exists' } });
      return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create EMI campaign' } });
    }
  });

  server.get<{ Params: { id: string } }>('/api/admin/emi-campaigns/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    if (!user) return reply.code(401).send({ error: { code: 'AUTH_INVALID', message: 'Missing authentication' } });
    const { id } = request.params as { id: string };
    try {
      const campaign = await server.db!.collection('emi_campaigns').findOne({ _id: id as any });
      if (!campaign) return reply.code(404).send({ error: { code: 'CAMPAIGN_NOT_FOUND', message: 'EMI campaign not found' } });
      return reply.send(EMICampaignSchema.parse(campaign));
    } catch { return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve EMI campaign' } }); }
  });

  server.patch<{ Params: { id: string }; Body: Partial<z.infer<typeof CreateEMICampaignSchema>> }>('/api/admin/emi-campaigns/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    if (!user) return reply.code(401).send({ error: { code: 'AUTH_INVALID', message: 'Missing authentication' } });
    const { id } = request.params as { id: string };
    const UpdateSchema = z.object({
      status: z.enum(['active', 'inactive']).optional(),
      max_total: z.number().int().positive().optional(),
      max_per_merchant: z.number().int().positive().nullable().optional(),
      max_per_card: z.number().int().positive().optional(),
      starts_at: z.string().datetime().optional(),
      ends_at: z.string().datetime().optional(),
    });
    const parseResult = UpdateSchema.safeParse(request.body as Record<string, unknown>);
    if (!parseResult.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: parseResult.error.message } });
    try {
      const result = await server.db!.collection('emi_campaigns').findOneAndUpdate({ _id: id as any }, { $set: { ...parseResult.data, updated_at: new Date().toISOString() } }, { returnDocument: 'after' });
      if (!result) return reply.code(404).send({ error: { code: 'CAMPAIGN_NOT_FOUND', message: 'EMI campaign not found' } });
      return reply.send(EMICampaignSchema.parse(result));
    } catch { return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update EMI campaign' } }); }
  });
}
