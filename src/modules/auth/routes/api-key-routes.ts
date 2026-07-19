import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CreateApiKeySchema } from '../schemas/api-key';
import { hashPassword } from '../../../lib/password';
import { randomBytes } from 'crypto';

/** Generates a random API key string. */
function generateApiKey(): string {
  return 'of_live_' + randomBytes(16).toString('hex');
}

/**
 * Registers API key management routes. Requires JWT auth + owner/admin role.
 * Routes: POST /api/api-keys, GET /api/api-keys, DELETE /api/api-keys/:id
 */
export function registerApiKeyRoutes(server: FastifyInstance): void {
  // POST /api/api-keys — create (returns plaintext once)
  server.post('/api/api-keys', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = CreateApiKeySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message } });
    }

    const user = request.user!;
    const db = server.db!;
    const { label, scopes } = parsed.data;

    const plaintextKey = generateApiKey();
    const keyHash = await hashPassword(plaintextKey);
    const now = new Date().toISOString();

    await db.collection('api_keys').insertOne({
      _id: `key_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` as unknown as import('mongodb').ObjectId,
      merchant_id: user.merchant_id,
      key_hash: keyHash,
      label,
      scopes,
      status: 'active',
      last_used_at: null,
      created_by: user.user_id,
      created_at: now,
      revoked_at: null,
    });

    return reply.code(201).send({ key: plaintextKey, label, scopes });
  });

  // GET /api/api-keys — list (no plaintext)
  server.get('/api/api-keys', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const db = server.db!;
    const keys = await db.collection('api_keys').find({
      merchant_id: user.merchant_id, status: { $ne: 'revoked' },
    }).sort({ created_at: -1 }).toArray();

    return reply.send({
      keys: keys.map((k) => ({
        _id: k._id, label: k.label, scopes: k.scopes, status: k.status,
        last_used_at: k.last_used_at, created_at: k.created_at,
      })),
    });
  });

  // DELETE /api/api-keys/:id — revoke
  server.delete('/api/api-keys/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const db = server.db!;
    const { id } = request.params as { id: string };

    const result = await db.collection('api_keys').updateOne(
      { _id: id, merchant_id: user.merchant_id, status: 'active' } as Record<string, unknown>,
      { $set: { status: 'revoked', revoked_at: new Date().toISOString() } },
    );

    if (result.matchedCount === 0) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'API key not found' } });
    }
    return reply.send({ revoked: true });
  });
}
