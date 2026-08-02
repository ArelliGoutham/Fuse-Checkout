import type { FastifyInstance } from 'fastify';
import type { Collection } from 'mongodb';
import { createServer } from '../../app';
import { startTestDatabase, stopTestDatabase, clearTestDatabase, getTestDatabase } from '../../test/setup-db';
import { createAuthMiddleware } from '../../middleware/auth';
import { errorHandler } from '../../middleware/error-handler';
import { registerAnalyticsRoutes } from './analytics-routes';
import type { Db } from '../../config/database';

describe('Analytics Routes', () => {
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

    server = createServer();
    server.setErrorHandler(errorHandler);
    server.decorate('db', testDb);

    server.addHook('preHandler', createAuthMiddleware(testDb));
    registerAnalyticsRoutes(server);

    // Insert test merchant
    await (testDb.collection('merchants') as unknown as Collection).insertOne(
      {
        _id: 'test-merchant-1',
        api_key_hash: 'test-key',
        name: 'Test Merchant',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    );

    // Insert test redemptions
    await (testDb.collection('redemptions') as unknown as Collection).insertMany([
      {
        offer_id: 'o1',
        merchant_id: 'test-merchant-1',
        session_id: 's1',
        cart_amount: 5000,
        discount_applied: 50,
        final_amount: 4950,
        order_id: 'ord1',
        order_status: 'paid',
        applied_at: new Date().toISOString(),
      },
      {
        offer_id: 'o2',
        merchant_id: 'test-merchant-1',
        session_id: 's2',
        cart_amount: 3000,
        discount_applied: 100,
        final_amount: 2900,
        order_id: null,
        order_status: 'abandoned',
        applied_at: new Date().toISOString(),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
  });

  afterEach(async () => {
    await server.close();
  });

  describe('GET /api/analytics/overview', () => {
    it('returns analytics overview with 200 status', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/analytics/overview',
        headers: { 'x-api-key': 'test-key' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('total_redemptions', 2);
      expect(body).toHaveProperty('conversions', 1);
      expect(body).toHaveProperty('abandoned', 1);
      expect(body).toHaveProperty('conversion_rate');
      expect(body).toHaveProperty('revenue_via_offers', 150); // 50 + 100
      expect(body).toHaveProperty('total_discount_given', 150);
    });

    it('limits offer summaries to the selected period', async () => {
      await (testDb.collection('redemptions') as unknown as Collection).insertOne({
        offer_id: 'o3',
        merchant_id: 'test-merchant-1',
        session_id: 's3',
        cart_amount: 1000,
        discount_applied: 500,
        final_amount: 500,
        order_id: 'ord3',
        order_status: 'paid',
        applied_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const response = await server.inject({
        method: 'GET',
        url: '/api/analytics/overview?period=7d',
        headers: { 'x-api-key': 'test-key' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        total_redemptions: 2,
        conversions: 1,
        total_discount_given: 150,
      });
    });
  });

  describe('GET /api/analytics/offers', () => {
    it('returns per-offer analytics with 200 status', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/analytics/offers',
        headers: { 'x-api-key': 'test-key' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body.offers)).toBe(true);
      expect(body.offers.length).toBeGreaterThan(0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const offer = body.offers.find((o: any) => o.offer_id === 'o1');
      expect(offer).toBeDefined();
      expect(offer).toHaveProperty('redemptions');
      expect(offer).toHaveProperty('conversions');
      expect(offer).toHaveProperty('revenue');
    });
  });
});
