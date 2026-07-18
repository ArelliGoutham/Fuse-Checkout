import type { FastifyInstance } from 'fastify';
import type { Collection } from 'mongodb';
import { createServer } from '../../../app';
import { startTestDatabase, stopTestDatabase, clearTestDatabase, getTestDatabase } from '../../../test/setup-db';
import { createAuthMiddleware } from '../../../middleware/auth';
import { errorHandler } from '../../../middleware/error-handler';
import { createOfferComponents } from '../services/offer-service';
import { registerTrackingRoutes } from './tracking-routes';
import type { Db } from '../../../config/database';

describe('Tracking Routes', () => {
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

    const { service } = createOfferComponents(testDb);
    server.decorate('offerService', service);
    server.decorate('db', testDb);

    server.addHook('preHandler', createAuthMiddleware(testDb));
    registerTrackingRoutes(server);

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

  describe('POST /api/track/conversion', () => {
    it('updates redemptions with order_id and order_status', async () => {
      // Insert a redemption record manually
      const now = new Date().toISOString();
      await (testDb.collection('redemptions') as unknown as Collection).insertOne({
        offer_id: 'offer-1',
        merchant_id: 'test-merchant-1',
        session_id: 'session-123',
        cart_amount: 1000,
        discount_applied: 100,
        final_amount: 900,
        customer_id: 'cust-1',
        applied_at: now,
        order_id: null,
        order_status: 'applied',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const response = await server.inject({
        method: 'POST',
        url: '/api/track/conversion',
        headers: { 'x-api-key': 'test-key' },
        payload: {
          session_id: 'session-123',
          order_id: 'order-456',
          order_value: 900,
          status: 'paid',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.tracked).toBe(true);
      expect(body.updated).toBe(1);

      // Verify redemption was updated
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const redemptions = await (testDb.collection('redemptions') as unknown as Collection).find({ session_id: 'session-123' } as any).toArray();

      expect(redemptions).toHaveLength(1);
      expect(redemptions[0]).toMatchObject({
        session_id: 'session-123',
        order_id: 'order-456',
        order_status: 'paid',
      });
    });

    it('returns 401 without API key', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/track/conversion',
        payload: {
          session_id: 'session-123',
          order_id: 'order-456',
          order_value: 900,
          status: 'paid',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
