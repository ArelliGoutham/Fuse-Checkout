import type { FastifyInstance } from 'fastify';
import type { Collection } from 'mongodb';
import { createServer } from '../../../app';
import { startTestDatabase, stopTestDatabase, clearTestDatabase, getTestDatabase } from '../../../test/setup-db';
import { createAuthMiddleware } from '../../../middleware/auth';
import { errorHandler } from '../../../middleware/error-handler';
import { createOfferComponents } from '../services/offer-service';
import { registerOfferRoutes } from './offer-routes';
import { registerCheckoutRoutes } from './checkout-routes';
import type { Offer } from '../types';
import type { Db } from '../../../config/database';

describe('Checkout Routes', () => {
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

    const { service, repository } = createOfferComponents(testDb);
    server.decorate('offerService', service);
    server.decorate('offerRepository', repository);
    server.decorate('db', testDb);

    server.addHook('preHandler', createAuthMiddleware(testDb));
    registerOfferRoutes(server);
    registerCheckoutRoutes(server);

    // Insert test merchant
    await (testDb.collection('merchants') as unknown as Collection).insertOne(
      {
        _id: 'test-merchant-1',
        api_key_hash: 'test-key',
        name: 'Test Merchant',
        stacking_policy: {
          max_coupons: 2,
          max_auto_offers: 1,
          max_total_discount: null,
          allow_cross_type: true,
          exclusive_tags: [],
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    );
  });

  afterEach(async () => {
    await server.close();
  });

  const createTestOffer = (overrides?: Partial<Offer>): Offer => ({
    _id: 'offer-1',
    merchant_id: 'test-merchant-1',
    code: 'TEST10',
    type: 'coupon',
    title: 'Test Offer',
    description: 'Test description',
    discount: { type: 'percentage', value: 10, max_discount: null },
    subsidy_model: 'merchant',
    status: 'active',
    validity: {
      starts_at: new Date().toISOString(),
      ends_at: new Date(Date.now() + 86400000).toISOString(),
    },
    usage_limits: { total: 100, per_customer: 5 },
    usage_count: 0,
    rules: [],
    stacking: { stacks_with: null, exclusive: false, priority: 0 },
    tags: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  });

  describe('POST /api/offers/available', () => {
    it('returns list of coupons and auto_offers with is_eligible flag', async () => {
      // Insert test offers
      const coupon = createTestOffer({ _id: 'coupon-1', type: 'coupon', code: 'COUPON10' });
      const autoOffer = createTestOffer({ _id: 'auto-1', type: 'auto_offer', code: 'AUTO20' });

      await (testDb.collection('offers') as unknown as Collection).insertMany([coupon, autoOffer] as unknown as any);

      const response = await server.inject({
        method: 'POST',
        url: '/api/offers/available',
        headers: { 'x-api-key': 'test-key' },
        payload: {
          cart: { amount: 1000, items: [{ sku_id: 'SKU1', price: 1000, qty: 1 }] },
          customer: { customer_id: 'cust-1', segments: ['vip'], total_orders: 5, per_customer_used: 0 },
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('coupons');
      expect(body).toHaveProperty('auto_offers');
      expect(body.coupons).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            _id: 'coupon-1',
            is_eligible: true,
          }),
        ]),
      );
      expect(body.auto_offers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            _id: 'auto-1',
            is_eligible: true,
          }),
        ]),
      );
    });

    it('returns 401 without API key', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/offers/available',
        payload: {
          cart: { amount: 1000, items: [{ sku_id: 'SKU1', price: 1000, qty: 1 }] },
          customer: { customer_id: 'cust-1', segments: ['vip'], total_orders: 5, per_customer_used: 0 },
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/offers/validate', () => {
    it('returns valid:true with discount details for valid code', async () => {
      const coupon = createTestOffer({ _id: 'coupon-1', code: 'VALID10', type: 'coupon' });
      await (testDb.collection('offers') as unknown as Collection).insertOne(coupon as unknown as any);

      const response = await server.inject({
        method: 'POST',
        url: '/api/offers/validate',
        headers: { 'x-api-key': 'test-key' },
        payload: {
          code: 'VALID10',
          cart: { amount: 1000, items: [{ sku_id: 'SKU1', price: 1000, qty: 1 }] },
          customer: { customer_id: 'cust-1', segments: [], total_orders: 0, per_customer_used: 0 },
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.valid).toBe(true);
      expect(body).toHaveProperty('offer');
      expect(body).toHaveProperty('discount_amount');
      expect(body).toHaveProperty('final_amount');
      expect(body.offer._id).toBe('coupon-1');
      expect(body.discount_amount).toBe(100); // 10% of 1000
      expect(body.final_amount).toBe(900);
    });

    it('returns 404 for unknown code', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/offers/validate',
        headers: { 'x-api-key': 'test-key' },
        payload: {
          code: 'UNKNOWN',
          cart: { amount: 1000, items: [{ sku_id: 'SKU1', price: 1000, qty: 1 }] },
          customer: { customer_id: 'cust-1', segments: [], total_orders: 0, per_customer_used: 0 },
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /api/offers/apply', () => {
    it('returns applied:true with discount details and creates redemption record', async () => {
      const coupon = createTestOffer({ _id: 'coupon-1', code: 'APPLY10', type: 'coupon' });
      await (testDb.collection('offers') as unknown as Collection).insertOne(coupon as unknown as any);

      const response = await server.inject({
        method: 'POST',
        url: '/api/offers/apply',
        headers: { 'x-api-key': 'test-key' },
        payload: {
          code: 'APPLY10',
          cart: { amount: 1000, items: [{ sku_id: 'SKU1', price: 1000, qty: 1 }] },
          customer: { customer_id: 'cust-1', segments: [], total_orders: 0, per_customer_used: 0 },
          session_id: 'session-123',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.applied).toBe(true);
      expect(body).toHaveProperty('offer');
      expect(body).toHaveProperty('discount_amount');
      expect(body).toHaveProperty('final_amount');

      // Verify redemption record was created
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const redemptions = await (testDb.collection('redemptions') as unknown as Collection)
        .find({ session_id: 'session-123' } as any)
        .toArray();

      expect(redemptions).toHaveLength(1);
      expect(redemptions[0]).toMatchObject({
        offer_id: 'coupon-1',
        merchant_id: 'test-merchant-1',
        session_id: 'session-123',
        customer_id: 'cust-1',
        cart_amount: 1000,
        discount_applied: 100,
        final_amount: 900,
        order_id: null,
        order_status: 'applied',
      });

      // Verify usage_count was incremented
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updatedOffer = await (testDb.collection('offers') as unknown as Collection).findOne({
        _id: 'coupon-1',
      } as any);
      expect(updatedOffer?.usage_count).toBe(1);
    });
  });
});
