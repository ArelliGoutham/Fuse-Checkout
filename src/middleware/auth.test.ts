import type { FastifyInstance, FastifyRequest } from 'fastify';
import { createServer } from '../app';
import { connectDatabase, closeDatabase } from '../config/database';
import { createAuthMiddleware } from './auth';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, ObjectId } from 'mongodb';

describe('createAuthMiddleware', () => {
  let server: FastifyInstance;
  let memServer: MongoMemoryServer;

  beforeAll(async () => {
    memServer = await MongoMemoryServer.create();
    const uri = memServer.getUri();
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('offerforge-test');
    await db.collection('merchants').insertOne({
      _id: new ObjectId('000000000000000000000001'),
      name: 'Test Merchant',
      api_key_hash: 'test-key-123',
      global_stacking_policy: {
        max_coupons: 1,
        max_auto_offers: 1,
        max_total_discount: null,
        allow_cross_type: true,
        exclusive_tags: [],
      },
      created_at: new Date().toISOString(),
    });
    await client.close();
    await connectDatabase(uri, 'offerforge-test');
  }, 60000);

  afterAll(async () => {
    await closeDatabase();
    await memServer.stop();
  });

  beforeEach(async () => {
    server = createServer();
    server.register(async (fastify) => {
      fastify.addHook('preHandler', createAuthMiddleware());
      fastify.get('/protected', async () => ({ message: 'success' }));
    });
  });

  afterEach(async () => {
    if (server) await server.close();
  });

  it('returns 401 when x-api-key header is missing', async () => {
    const response = await server.inject({ method: 'GET', url: '/protected' });
    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('AUTH_INVALID');
  });

  it('returns 401 when x-api-key is invalid', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/protected',
      headers: { 'x-api-key': 'invalid-key' },
    });
    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('AUTH_INVALID');
  });

  it('sets merchantId on request when api key is valid', async () => {
    let capturedMerchantId: string | undefined;
    server = createServer();
    server.register(async (fastify) => {
      fastify.addHook('preHandler', createAuthMiddleware());
      fastify.get('/protected', async (request: FastifyRequest) => {
        capturedMerchantId = request.merchantId;
        return { message: 'success' };
      });
    });

    const response = await server.inject({
      method: 'GET',
      url: '/protected',
      headers: { 'x-api-key': 'test-key-123' },
    });
    expect(response.statusCode).toBe(200);
    expect(capturedMerchantId).toBe('000000000000000000000001');
  });
});
