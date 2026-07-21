import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { CreateIINRangeSchema, IINRangeSchema } from '../schemas/iin-range';
import type { IINRange } from '../schemas/iin-range';

export function registerIINRangeRoutes(server: FastifyInstance): void {
  server.get('/api/admin/iin-ranges', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    if (!user) return reply.code(401).send({ error: { code: 'AUTH_INVALID', message: 'Missing authentication' } });
    try {
      const ranges = await server.db!.collection('iin_ranges').find({ status: 'active' }).toArray();
      return reply.send({ iin_ranges: ranges.map((r: unknown) => IINRangeSchema.parse(r)) });
    } catch { return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve IIN ranges' } }); }
  });

  server.post<{ Body: z.infer<typeof CreateIINRangeSchema> }>('/api/admin/iin-ranges', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    if (!user) return reply.code(401).send({ error: { code: 'AUTH_INVALID', message: 'Missing authentication' } });
    const parseResult = CreateIINRangeSchema.safeParse(request.body as Record<string, unknown>);
    if (!parseResult.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: parseResult.error.message } });
    const range: IINRange = { _id: 'iin_' + parseResult.data.prefix, ...parseResult.data, status: 'active', updated_at: new Date().toISOString() };
    try {
      await server.db!.collection('iin_ranges').insertOne(range as any);
      return reply.code(201).send(range);
    } catch (error: any) {
      if (error.code === 11000) return reply.code(409).send({ error: { code: 'DUPLICATE_IIN', message: 'IIN range already exists' } });
      return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create IIN range' } });
    }
  });
}
