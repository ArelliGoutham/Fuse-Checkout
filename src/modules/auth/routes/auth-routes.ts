import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Db } from 'mongodb';
import { SignupSchema, LoginSchema } from '../schemas/user';
import { hashPassword, verifyPassword } from '../../../lib/password';
import { generateToken } from '../../../lib/jwt';
import { AppError } from '../../../lib/errors';

/**
 * Registers authentication routes (signup, login, me) to the Fastify server.
 * @param server - The Fastify instance to register routes on
 */
export function registerAuthRoutes(server: FastifyInstance): void {
  /**
   * POST /api/auth/signup
   * Creates a new user and merchant account
   */
  server.post<{ Body: unknown }>(
    '/api/auth/signup',
    async (request: FastifyRequest<{ Body: unknown }>, reply: FastifyReply) => {
      // Validate input
      const validation = SignupSchema.safeParse(request.body);
      if (!validation.success) {
        throw new AppError('Invalid input', 'VALIDATION_ERROR', 400);
      }

      const { email, password, name, store_name } = validation.data;
      const db = server.db as Db;

      // Check if email already exists
      const usersDb = db.collection('users');
      const existingUser = await usersDb.findOne({ email } as any);
      if (existingUser) {
        throw new AppError('Email already exists', 'EMAIL_EXISTS', 409);
      }

      // Hash password
      const password_hash = await hashPassword(password);

      // Generate IDs
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8);
      const user_id = `user_${timestamp}_${random}`;
      const merchant_id = `merch_${timestamp}_${random}`;

      const now = new Date().toISOString();

      // Create merchant
      const merchantsDb = db.collection('merchants');
      await merchantsDb.insertOne({
        _id: merchant_id as any,
        name: store_name,
        global_stacking_policy: 'no_stacking',
        created_at: now,
        updated_at: now,
      } as any);

      // Create user
      await usersDb.insertOne({
        _id: user_id as any,
        email,
        password_hash,
        name,
        created_at: now,
        updated_at: now,
      } as any);

      // Create merchant_user link
      const merchantUsersDb = db.collection('merchant_users');
      await merchantUsersDb.insertOne({
        _id: `mu_${timestamp}_${random}` as any,
        merchant_id,
        email,
        user_id,
        role: 'owner',
        status: 'active',
        invite_code: '',
        invited_by: user_id,
        invited_at: now,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        accepted_at: now,
      } as any);

      // Generate token
      const token = generateToken({
        user_id,
        merchant_id,
        role: 'owner',
      });

      reply.code(201).send({
        token,
        user: {
          _id: user_id,
          email,
          name,
        },
        merchant: {
          _id: merchant_id,
          name: store_name,
        },
        role: 'owner',
      });
    },
  );

  /**
   * POST /api/auth/login
   * Authenticates user and returns JWT token
   */
  server.post<{ Body: unknown }>(
    '/api/auth/login',
    async (request: FastifyRequest<{ Body: unknown }>, reply: FastifyReply) => {
      // Validate input
      const validation = LoginSchema.safeParse(request.body);
      if (!validation.success) {
        throw new AppError('Invalid input', 'VALIDATION_ERROR', 400);
      }

      const { email, password } = validation.data;
      const db = server.db as Db;

      // Find user by email
      const usersDb = db.collection('users');
      const user = await usersDb.findOne({ email } as any) as any;
      if (!user) {
        throw new AppError('Invalid email or password', 'AUTH_INVALID', 401);
      }

      // Verify password
      const passwordMatch = await verifyPassword(password, user.password_hash);
      if (!passwordMatch) {
        throw new AppError('Invalid email or password', 'AUTH_INVALID', 401);
      }

      // Find active merchant_user
      const merchantUsersDb = db.collection('merchant_users');
      const merchantUser = await merchantUsersDb.findOne({
        user_id: user._id,
        status: 'active',
      } as any) as any;

      if (!merchantUser) {
        throw new AppError('No active merchant found', 'NO_MERCHANT', 403);
      }

      // Get merchant info
      const merchantsDb = db.collection('merchants');
      const merchant = await merchantsDb.findOne({ _id: merchantUser.merchant_id } as any) as any;

      // Generate token
      const token = generateToken({
        user_id: user._id as string,
        merchant_id: merchantUser.merchant_id as string,
        role: merchantUser.role,
      });

      reply.code(200).send({
        token,
        user: {
          _id: user._id,
          email: user.email,
          name: user.name,
        },
        merchant: {
          _id: merchant?._id,
          name: merchant?.name,
        },
        role: merchantUser.role,
      });
    },
  );

  /**
   * GET /api/auth/me
   * Returns current user info (requires valid JWT)
   */
  server.get<{ Reply: unknown }>(
    '/api/auth/me',
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.user) {
        throw new AppError('Unauthorized', 'AUTH_INVALID', 401);
      }

      const db = server.db as Db;
      const { user_id, merchant_id } = request.user;

      // Fetch user
      const usersDb = db.collection('users');
      const user = await usersDb.findOne({ _id: user_id } as any) as any;

      // Fetch merchant
      const merchantsDb = db.collection('merchants');
      const merchant = await merchantsDb.findOne({ _id: merchant_id } as any) as any;

      reply.code(200).send({
        user: {
          _id: user?._id,
          email: user?.email,
          name: user?.name,
        },
        merchant: {
          _id: merchant?._id,
          name: merchant?.name,
        },
        role: request.user.role,
      });
    },
  );
}

/**
 * FastifyRequest augmentation for JWT payload
 */
declare module 'fastify' {
  interface FastifyRequest {
    user?: { user_id: string; merchant_id: string; role: string };
  }
}

