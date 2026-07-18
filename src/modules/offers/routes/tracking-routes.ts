import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

const TrackingSchema = z.object({
  session_id: z.string().min(1),
  order_id: z.string().min(1),
  order_value: z.number().positive(),
  status: z.enum(['paid', 'abandoned']),
});

type TrackingRequest = z.infer<typeof TrackingSchema>;

export async function registerTrackingRoutes(server: FastifyInstance): Promise<void> {
  server.post<{ Body: TrackingRequest }>(
    '/api/track/conversion',
    async (request: FastifyRequest<{ Body: TrackingRequest }>, reply: FastifyReply) => {
      // Validate request body
      const parsed = TrackingSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'Invalid request body',
          details: parsed.error.issues,
        });
      }

      const { session_id, order_id, status } = parsed.data;
      const merchantId = request.merchantId;

      if (!merchantId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const db = server.db;
      if (!db) {
        return reply.code(500).send({ error: 'Database not configured' });
      }

      try {

        // Update all redemptions matching session_id and merchant_id
        const result = await db.collection('redemptions').updateMany(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          { session_id, merchant_id: merchantId } as any,
          {
            $set: {
              order_id,
              order_status: status,
              updated_at: new Date().toISOString(),
            },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
        );

        return reply.code(200).send({
          tracked: true,
          updated: result.modifiedCount,
        });
      } catch (error) {
        request.log.error(error);
        return reply.code(500).send({
          error: 'Internal server error',
        });
      }
    },
  );
}
