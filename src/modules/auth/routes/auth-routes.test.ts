import { createServer } from '../../../app';
import { errorHandler } from '../../../middleware/error-handler';
import { startTestDatabase, stopTestDatabase, clearTestDatabase, getTestDatabase } from '../../../test/setup-db';
import { registerAuthRoutes } from './auth-routes';
import type { FastifyInstance, FastifyRequest } from 'fastify';

describe('Auth Routes', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    await startTestDatabase();
  });

  afterAll(async () => {
    await stopTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();
    server = createServer();
    server.setErrorHandler(errorHandler);
    server.decorate('db', getTestDatabase());

    // Add JWT middleware for /me endpoint
    server.addHook('preHandler', async (request: FastifyRequest) => {
      const authHeader = request.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        try {
          const { verifyToken } = await import('../../../lib/jwt');
          const payload = verifyToken(token);
          request.user = {
            user_id: payload.user_id,
            merchant_id: payload.merchant_id,
            role: payload.role,
          };
        } catch (e) {
          // Invalid token, ignore for now
        }
      }
    });

    registerAuthRoutes(server);
  });

  afterEach(async () => {
    if (server) await server.close();
  });

  describe('POST /api/auth/signup', () => {
    it('creates user and merchant, returns 201 with token', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/signup',
        payload: {
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
          store_name: 'Test Store',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.token).toBeDefined();
      expect(body.user).toBeDefined();
      expect(body.user._id).toBeDefined();
      expect(body.user.email).toBe('test@example.com');
      expect(body.user.name).toBe('Test User');
      expect(body.merchant).toBeDefined();
      expect(body.merchant._id).toBeDefined();
      expect(body.merchant.name).toBe('Test Store');
      expect(body.role).toBe('owner');

      // Verify user was created in DB
      const usersDb = db.collection('users');
      const user = await usersDb.findOne({ email: 'test@example.com' });
      expect(user).toBeDefined();
      expect(user?.password_hash).toBeDefined();
      expect(user?.password_hash).not.toBe('password123');

      // Verify merchant was created in DB
      const merchantsDb = db.collection('merchants');
      const merchant = await merchantsDb.findOne({ name: 'Test Store' });
      expect(merchant).toBeDefined();

      // Verify merchant_user link was created
      const merchantUsersDb = db.collection('merchant_users');
      const merchantUser = await merchantUsersDb.findOne({
        user_id: user?._id,
        merchant_id: merchant?._id,
      });
      expect(merchantUser).toBeDefined();
      expect(merchantUser?.role).toBe('owner');
      expect(merchantUser?.status).toBe('active');
    });

    it('returns 409 EMAIL_EXISTS if email already exists', async () => {
      // Create first user
      await server.inject({
        method: 'POST',
        url: '/api/auth/signup',
        payload: {
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
          store_name: 'Test Store',
        },
      });

      // Try to create second user with same email
      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/signup',
        payload: {
          email: 'test@example.com',
          password: 'password456',
          name: 'Another User',
          store_name: 'Another Store',
        },
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('EMAIL_EXISTS');
    });

    it('returns 400 on invalid email', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/signup',
        payload: {
          email: 'invalid-email',
          password: 'password123',
          name: 'Test User',
          store_name: 'Test Store',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('returns 400 on password < 8 chars', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/signup',
        payload: {
          email: 'test@example.com',
          password: 'pass123',
          name: 'Test User',
          store_name: 'Test Store',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create a user
      await server.inject({
        method: 'POST',
        url: '/api/auth/signup',
        payload: {
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
          store_name: 'Test Store',
        },
      });
    });

    it('returns 200 with token after successful login', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.token).toBeDefined();
      expect(body.user).toBeDefined();
      expect(body.user._id).toBeDefined();
      expect(body.user.email).toBe('test@example.com');
      expect(body.user.name).toBe('Test User');
      expect(body.merchant).toBeDefined();
      expect(body.merchant._id).toBeDefined();
      expect(body.role).toBe('owner');
    });

    it('returns 401 on invalid password', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'wrongpassword',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('AUTH_INVALID');
    });

    it('returns 401 on non-existent email', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'nonexistent@example.com',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('AUTH_INVALID');
    });

    it('returns 403 NO_MERCHANT if user has no active merchant', async () => {
      // Create a user without a merchant link
      const usersDb = db.collection('users');
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8);
      const user_id = `user_test_orphan_${timestamp}_${random}`;
      await usersDb.insertOne({
        _id: user_id as any,
        email: 'orphan@example.com',
        password_hash: 'hashed_password',
        name: 'Orphan User',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'orphan@example.com',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('NO_MERCHANT');
    });
  });

  describe('GET /api/auth/me', () => {
    let token: string;
    let userId: string;
    let merchantId: string;

    beforeEach(async () => {
      // Create a user
      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/signup',
        payload: {
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
          store_name: 'Test Store',
        },
      });

      const body = JSON.parse(response.body);
      token = body.token;
      userId = body.user._id;
      merchantId = body.merchant._id;
    });

    it('returns user and merchant info with valid token', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.user._id).toBe(userId);
      expect(body.user.email).toBe('test@example.com');
      expect(body.user.name).toBe('Test User');
      expect(body.merchant._id).toBe(merchantId);
      expect(body.merchant.name).toBe('Test Store');
      expect(body.role).toBe('owner');
    });

    it('returns 401 without token', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/auth/me',
      });

      expect(response.statusCode).toBe(401);
    });

    it('returns 401 with invalid token', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          authorization: 'Bearer invalid_token',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
