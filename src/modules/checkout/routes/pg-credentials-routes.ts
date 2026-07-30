import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { SavePGCredentialsSchema } from '../schemas/pg-credentials';
import type { PGCredentials } from '../schemas/pg-credentials';
import { MongoPGCredentialsRepository } from '../repositories/mongo-pg-credentials-repository';
import { encrypt } from '../../../lib/encryption';

/**
 * Registers payment gateway credential management routes.
 * All endpoints require JWT authentication (dashboard only).
 */
export function registerPGCredentialsRoutes(server: FastifyInstance): void {
  /**
   * GET /api/admin/pg-credentials — List merchant's PG connections
   */
  server.get(
    '/api/admin/pg-credentials',
    { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = (request as any).user;
      if (!user) {
        return reply.code(401).send({
          error: { code: 'AUTH_INVALID', message: 'Missing authentication' },
        });
      }

      const merchantId = (request as any).merchantId || user.merchant_id;
      const db = server.db!;
      const repo = new MongoPGCredentialsRepository(db);

      try {
        const credentials = await repo.findByMerchant(merchantId);
        // Strip encrypted values — return only metadata
        const safe = credentials.map((c: PGCredentials) => ({
          pg_name: c.pg_name,
          status: c.status,
          test_mode: c.test_mode,
          connected_at: c.connected_at,
        }));
        return reply.send({ pg_credentials: safe });
      } catch {
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve PG credentials' },
        });
      }
    }
  );

  /**
   * POST /api/admin/pg-credentials — Save PG credentials (encrypts keys)
   */
  server.post<{ Body: z.infer<typeof SavePGCredentialsSchema> }>(
    '/api/admin/pg-credentials',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = (request as any).user;
      if (!user) {
        return reply.code(401).send({
          error: { code: 'AUTH_INVALID', message: 'Missing authentication' },
        });
      }

      const parseResult = SavePGCredentialsSchema.safeParse(request.body as Record<string, unknown>);
      if (!parseResult.success) {
        return reply.code(400).send({
          error: { code: 'VALIDATION_ERROR', message: parseResult.error.message },
        });
      }

      const merchantId = (request as any).merchantId || user.merchant_id;
      const encryptionKey = process.env.ENCRYPTION_KEY || 'fuse-encryption-key-change-me-32';
      const now = new Date().toISOString();

      const credentials: PGCredentials = {
        _id: `pgcred_${merchantId}_${parseResult.data.pg_name}`,
        merchant_id: merchantId,
        pg_name: parseResult.data.pg_name,
        api_key_encrypted: encrypt(parseResult.data.api_key, encryptionKey),
        api_secret_encrypted: encrypt(parseResult.data.api_secret, encryptionKey),
        webhook_secret_encrypted: parseResult.data.webhook_secret
          ? encrypt(parseResult.data.webhook_secret, encryptionKey)
          : null,
        status: 'active',
        test_mode: parseResult.data.test_mode,
        connected_at: now,
        updated_at: now,
      };

      const db = server.db!;
      const repo = new MongoPGCredentialsRepository(db);

      try {
        await repo.save(credentials);
        return reply.code(201).send({
          pg_name: credentials.pg_name,
          status: 'active',
          test_mode: credentials.test_mode,
          connected_at: credentials.connected_at,
        });
      } catch {
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Failed to save PG credentials' },
        });
      }
    }
  );

  /**
   * DELETE /api/admin/pg-credentials/:pg_name — Deactivate PG connection
   */
  server.delete<{ Params: { pg_name: string } }>(
    '/api/admin/pg-credentials/:pg_name',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = (request as any).user;
      if (!user) {
        return reply.code(401).send({
          error: { code: 'AUTH_INVALID', message: 'Missing authentication' },
        });
      }

      const merchantId = (request as any).merchantId || user.merchant_id;
      const { pg_name } = request.params as { pg_name: string };
      const db = server.db!;
      const repo = new MongoPGCredentialsRepository(db);

      try {
        const deactivated = await repo.deactivate(merchantId, pg_name);
        if (!deactivated) {
          return reply.code(404).send({
            error: { code: 'PG_NOT_FOUND', message: 'PG credentials not found' },
          });
        }
        return reply.send({ deactivated: true, pg_name });
      } catch {
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Failed to deactivate PG credentials' },
        });
      }
    }
  );
}
