import type { Document } from 'mongodb';
import { createServer } from '../app';
import { connectDatabase, closeDatabase, getDatabase } from '../config/database';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { Db } from 'mongodb';
import type { FastifyInstance } from 'fastify';
import { registerOfferRoutes } from '../modules/offers/routes/offer-routes';
import { registerCheckoutRoutes } from '../modules/offers/routes/checkout-routes';
import { registerTrackingRoutes } from '../modules/offers/routes/tracking-routes';
import { registerProductRoutes } from '../modules/products/routes/product-routes';
import { registerAnalyticsRoutes } from '../modules/analytics/analytics-routes';
import { createOfferComponents } from '../modules/offers';
import { createAuthMiddleware } from '../middleware/auth';
import { errorHandler } from '../middleware/error-handler';

const MERCHANT = {
  _id: 'merch_test',
  name: 'Test Merchant',
  api_key_hash: 'test-key',
  global_stacking_policy: {
    max_coupons: 1,
    max_auto_offers: 1,
    max_total_discount: null,
    allow_cross_type: true,
    exclusive_tags: [],
  },
  created_at: new Date().toISOString(),
};

const headers = { 'x-api-key': 'test-key' };

describe('Golden Path Integration Test', () => {
  let memServer: MongoMemoryServer;
  let server: FastifyInstance;
  let db: Db;

  beforeAll(async () => {
    memServer = await MongoMemoryServer.create();
    await connectDatabase(memServer.getUri(), 'fuse_test');
    db = getDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
    await memServer.stop();
  });

  beforeEach(async () => {
    for (const col of ['products', 'offers', 'redemptions', 'merchants']) {
      await db.collection(col).deleteMany({});
    }
    await db.collection('merchants').insertOne(MERCHANT as unknown as Document);

    server = createServer();
    const { service, repository } = createOfferComponents(db);
    server.decorate('db', db);
    server.decorate('offerService', service);
    server.decorate('offerRepository', repository);
    server.setErrorHandler(errorHandler);
    server.addHook('preHandler', createAuthMiddleware(db));
    registerOfferRoutes(server);
    registerCheckoutRoutes(server);
    registerTrackingRoutes(server);
    registerProductRoutes(server);
    registerAnalyticsRoutes(server);
    await server.ready();
  });

  afterEach(async () => {
    await server.close();
  });

  it('completes full offer lifecycle', async () => {
    // 1. Create product
    const productRes = await server.inject({
      method: 'POST', url: '/api/products', headers,
      payload: { sku_id: 'SKU-IP15', name: 'iPhone 15', category: 'electronics', brand: 'Apple' },
    });
    expect(productRes.statusCode).toBe(201);

    // 2. Create coupon
    const offerRes = await server.inject({
      method: 'POST', url: '/api/offers', headers,
      payload: {
        code: 'FLAT50', type: 'coupon', title: 'Flat 50 off',
        discount: { type: 'flat', value: 50, max_discount: null },
        validity: { starts_at: '2026-01-01T00:00:00.000Z', ends_at: '2026-12-31T23:59:59.000Z' },
        usage_limits: { total: null, per_customer: null },
        rules: [{ rule_type: 'min_cart_value', config: { min_amount: 500 } }],
      },
    });
    expect(offerRes.statusCode).toBe(201);

    // 3. Check availability
    const availRes = await server.inject({
      method: 'POST', url: '/api/offers/available', headers,
      payload: {
        cart: { amount: 5000, items: [{ sku_id: 'SKU-IP15', price: 5000, qty: 1 }] },
        customer: { customer_id: 'c1', segments: [], total_orders: 0, per_customer_used: 0 },
      },
    });
    expect(availRes.statusCode).toBe(200);
    const availBody = JSON.parse(availRes.body);
    expect(availBody.coupons.length).toBeGreaterThan(0);

    // 4. Validate code
    const validRes = await server.inject({
      method: 'POST', url: '/api/offers/validate', headers,
      payload: {
        code: 'FLAT50',
        cart: { amount: 5000, items: [{ sku_id: 'SKU-IP15', price: 5000, qty: 1 }] },
        customer: { customer_id: 'c1', segments: [], total_orders: 0, per_customer_used: 0 },
      },
    });
    expect(validRes.statusCode).toBe(200);
    const validBody = JSON.parse(validRes.body);
    expect(validBody.valid).toBe(true);
    expect(validBody.discount_amount).toBe(50);

    // 5. Apply coupon
    const applyRes = await server.inject({
      method: 'POST', url: '/api/offers/apply', headers,
      payload: {
        code: 'FLAT50',
        cart: { amount: 5000, items: [{ sku_id: 'SKU-IP15', price: 5000, qty: 1 }] },
        customer: { customer_id: 'c1', segments: [], total_orders: 0, per_customer_used: 0 },
        session_id: 'sess_golden_1',
      },
    });
    expect(applyRes.statusCode).toBe(200);
    const applyBody = JSON.parse(applyRes.body);
    expect(applyBody.applied).toBe(true);
    expect(applyBody.discount_amount).toBe(50);
    expect(applyBody.final_amount).toBe(4950);

    // 6. Track conversion
    const trackRes = await server.inject({
      method: 'POST', url: '/api/track/conversion', headers,
      payload: { session_id: 'sess_golden_1', order_id: 'order_1', order_value: 4950, status: 'paid' },
    });
    expect(trackRes.statusCode).toBe(200);

    // 7. Check analytics
    const analyticsRes = await server.inject({
      method: 'GET', url: '/api/analytics/overview', headers,
    });
    expect(analyticsRes.statusCode).toBe(200);
    const analytics = JSON.parse(analyticsRes.body);
    expect(analytics.total_redemptions).toBeGreaterThanOrEqual(1);
    expect(analytics.conversions).toBeGreaterThanOrEqual(1);
  });
});
