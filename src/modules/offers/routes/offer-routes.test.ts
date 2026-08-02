import type { FastifyInstance } from 'fastify';
import type { Collection } from 'mongodb';
import { createServer } from '../../../app';
import { startTestDatabase, stopTestDatabase, clearTestDatabase, getTestDatabase } from '../../../test/setup-db';
import { createAuthMiddleware } from '../../../middleware/auth';
import { errorHandler } from '../../../middleware/error-handler';
import { createOfferComponents } from '../services/offer-service';
import { registerOfferRoutes } from './offer-routes';
import type { Offer } from '../types';
import type { Db } from '../../../config/database';

describe('Offer Routes', () => {
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

    const { repository } = createOfferComponents(testDb);
    server.decorate('offerRepository', repository);
    server.decorate('db', testDb);

    server.addHook('preHandler', createAuthMiddleware(testDb));
    registerOfferRoutes(server);

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

  describe('POST /api/offers', () => {
    it('creates an offer with 201 status', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/offers',
        headers: { 'x-api-key': 'test-key' },
        payload: {
          code: 'NEWCODE',
          type: 'coupon',
          title: 'New Offer',
          discount: { type: 'percentage', value: 20, max_discount: null },
          validity: {
            starts_at: new Date().toISOString(),
            ends_at: new Date(Date.now() + 86400000).toISOString(),
          },
          usage_limits: { total: 50, per_customer: 2 },
          rules: [],
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('_id');
      expect(body).toHaveProperty('code', 'NEWCODE');
      expect(body).toHaveProperty('merchant_id', 'test-merchant-1');
      expect(body).toHaveProperty('status', 'active');
      expect(body).toHaveProperty('usage_count', 0);
      expect(body).toHaveProperty('subsidy_model', 'merchant');
    });

    it('returns 401 without API key', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/offers',
        payload: {
          code: 'NEWCODE',
          type: 'coupon',
          title: 'New Offer',
          discount: { type: 'percentage', value: 20, max_discount: null },
          validity: {
            starts_at: new Date().toISOString(),
            ends_at: new Date(Date.now() + 86400000).toISOString(),
          },
          usage_limits: { total: 50, per_customer: 2 },
          rules: [],
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('returns 400 for invalid payload', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/offers',
        headers: { 'x-api-key': 'test-key' },
        payload: {
          code: 'NEWCODE',
          // missing type
          title: 'New Offer',
          discount: { type: 'percentage', value: 20, max_discount: null },
          validity: {
            starts_at: new Date().toISOString(),
            ends_at: new Date(Date.now() + 86400000).toISOString(),
          },
          usage_limits: { total: 50, per_customer: 2 },
          rules: [],
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/offers', () => {
    it('lists offers for merchant', async () => {
      const offer1 = createTestOffer({ _id: 'offer-1', code: 'CODE1' });
      const offer2 = createTestOffer({ _id: 'offer-2', code: 'CODE2' });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (testDb.collection('offers') as unknown as Collection).insertMany([offer1, offer2] as any);

      const response = await server.inject({
        method: 'GET',
        url: '/api/offers',
        headers: { 'x-api-key': 'test-key' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('offers');
      expect(Array.isArray(body.offers)).toBe(true);
      expect(body.offers).toHaveLength(2);
    });

    it('returns 401 without API key', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/offers',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/offers/:id', () => {
    it('returns offer by id', async () => {
      const offer = createTestOffer();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (testDb.collection('offers') as unknown as Collection).insertOne(offer as any);

      const response = await server.inject({
        method: 'GET',
        url: '/api/offers/offer-1',
        headers: { 'x-api-key': 'test-key' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual(offer);
    });

    it('returns 404 for nonexistent offer', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/offers/nonexistent',
        headers: { 'x-api-key': 'test-key' },
      });

      expect(response.statusCode).toBe(404);
    });

    it('returns 401 without API key', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/offers/offer-1',
      });

      expect(response.statusCode).toBe(401);
    });

    it('returns 404 for other merchant offers', async () => {
      const offer = createTestOffer({ merchant_id: 'other-merchant' });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (testDb.collection('offers') as unknown as Collection).insertOne(offer as any);

      const response = await server.inject({
        method: 'GET',
        url: '/api/offers/offer-1',
        headers: { 'x-api-key': 'test-key' },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/offers/:id', () => {
    it('deletes offer and returns 200', async () => {
      const offer = createTestOffer();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (testDb.collection('offers') as unknown as Collection).insertOne(offer as any);

      const response = await server.inject({
        method: 'DELETE',
        url: '/api/offers/offer-1',
        headers: { 'x-api-key': 'test-key' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual({ deleted: true });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const found = await (testDb.collection('offers') as unknown as Collection).findOne({ _id: 'offer-1' } as any);
      expect(found).toBeNull();
    });

    it('returns 404 for nonexistent offer', async () => {
      const response = await server.inject({
        method: 'DELETE',
        url: '/api/offers/nonexistent',
        headers: { 'x-api-key': 'test-key' },
      });

      expect(response.statusCode).toBe(404);
    });

    it('returns 401 without API key', async () => {
      const response = await server.inject({
        method: 'DELETE',
        url: '/api/offers/offer-1',
      });

      expect(response.statusCode).toBe(401);
    });

    it('respects merchant isolation', async () => {
      const offer = createTestOffer({ merchant_id: 'other-merchant' });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (testDb.collection('offers') as unknown as Collection).insertOne(offer as any);

      const response = await server.inject({
        method: 'DELETE',
        url: '/api/offers/offer-1',
        headers: { 'x-api-key': 'test-key' },
      });

      expect(response.statusCode).toBe(404);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const found = await (testDb.collection('offers') as unknown as Collection).findOne({ _id: 'offer-1' } as any);
      expect(found).not.toBeNull();
    });
  });
});
