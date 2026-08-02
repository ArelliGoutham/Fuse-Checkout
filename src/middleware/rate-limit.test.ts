import type { FastifyInstance } from 'fastify';
import type { Db } from 'mongodb';
import { createServer } from '../app';
import { startTestDatabase, stopTestDatabase, clearTestDatabase, getTestDatabase } from '../test/setup-db';
import { createAuthMiddleware } from './auth';
import { errorHandler } from './error-handler';
import type { Collection } from 'mongodb';

describe('Rate Limiting', () => {
  let server: FastifyInstance;
  let testDb: Db;

  beforeAll(async () => {
    await startTestDatabase();
    testDb = getTestDatabase();
  });

  afterAll(async () => {
    await stopTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();

    server = await createServer();
    server.setErrorHandler(errorHandler);
    server.decorate('db', testDb);

    server.addHook('preHandler', createAuthMiddleware(testDb));

    // Register a test route with very low rate limit (max: 1 per minute)
    server.get(
      '/test-rate-limit',
      { config: { rateLimit: { max: 1, timeWindow: '1 minute' } } },
      async () => ({ status: 'ok' }),
    );

    // Insert test merchant
    await (testDb.collection('merchants') as unknown as Collection).insertOne(
      {
        _id: 'test-merchant-1',
        api_key_hash: 'test-key',
        name: 'Test Merchant',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    );
  });

  afterEach(async () => {
    await server.close();
  });

  it('should return 429 after exceeding rate limit', async () => {
    // First request should succeed
    let response = await server.inject({
      method: 'GET',
      url: '/test-rate-limit',
      headers: { 'x-api-key': 'test-key' },
    });
    expect(response.statusCode).toBe(200);

    // Second request should be rate limited (429)
    response = await server.inject({
      method: 'GET',
      url: '/test-rate-limit',
      headers: { 'x-api-key': 'test-key' },
    });
    expect(response.statusCode).toBe(429);
  });
});
