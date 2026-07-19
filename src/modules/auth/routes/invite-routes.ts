import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CreateInviteSchema, type Role, canInvite } from '../schemas/invite';
import { generateInviteCode } from '../../../lib/invite-code';

const INVITE_EXPIRY_DAYS = 7;

/**
 * Registers team invite routes. Requires JWT auth (request.user must be set).
 * Routes: POST /api/team/invite, GET /api/team/invites, DELETE /api/team/invites/:code
 */
export function registerInviteRoutes(server: FastifyInstance): void {
  // POST /api/team/invite — create invite
  server.post('/api/team/invite', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = CreateInviteSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message } });
    }

    const user = request.user!;
    const db = server.db!;
    const { email, role } = parsed.data;

    if (!canInvite(user.role as Role, role as Role)) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Cannot invite someone with equal or higher role' } });
    }

    const existing = await db.collection('merchant_users').findOne({
      merchant_id: user.merchant_id, email, status: 'pending',
    });
    if (existing) {
      return reply.code(409).send({ error: { code: 'INVITE_EXISTS', message: 'Pending invite already exists for this email' } });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    const inviteCode = generateInviteCode();

    await db.collection('merchant_users').insertOne({
      _id: `mu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` as unknown as import('mongodb').ObjectId,
      merchant_id: user.merchant_id,
      email,
      user_id: null,
      role,
      status: 'pending',
      invite_code: inviteCode,
      invited_by: user.user_id,
      invited_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      accepted_at: null,
    });

    return reply.code(201).send({
      invite_code: inviteCode,
      email,
      role,
      expires_at: expiresAt.toISOString(),
      invite_url: `/invite/${inviteCode}`,
    });
  });

  // GET /api/team/invites — paginated list
  server.get('/api/team/invites', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const db = server.db!;
    const query = request.query as { page?: string; limit?: string; status?: string };

    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(query.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { merchant_id: user.merchant_id };
    if (query.status && query.status !== 'all') filter.status = query.status;

    const [invites, total] = await Promise.all([
      db.collection('merchant_users').find(filter).sort({ invited_at: -1 }).skip(skip).limit(limit).toArray(),
      db.collection('merchant_users').countDocuments(filter),
    ]);

    return reply.send({
      invites: invites.map((i) => ({
        email: i.email, role: i.role, status: i.status,
        invite_code: i.invite_code, invited_at: i.invited_at,
        expires_at: i.expires_at, accepted_at: i.accepted_at,
      })),
      total, page, limit,
      total_pages: Math.ceil(total / limit),
    });
  });

  // DELETE /api/team/invites/:code — revoke invite
  server.delete('/api/team/invites/:code', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const db = server.db!;
    const { code } = request.params as { code: string };

    const result = await db.collection('merchant_users').updateOne(
      { merchant_id: user.merchant_id, invite_code: code, status: 'pending' },
      { $set: { status: 'removed' } },
    );

    if (result.matchedCount === 0) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Invite not found' } });
    }
    return reply.send({ revoked: true });
  });
}
