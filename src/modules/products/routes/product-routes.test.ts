import type { FastifyInstance } from 'fastify';
import type { Collection } from 'mongodb';
import { createServer } from '../../../app';
import { startTestDatabase, stopTestDatabase, clearTestDatabase, getTestDatabase } from '../../../test/setup-db';
import { createAuthMiddleware } from '../../../middleware/auth';
import { errorHandler } from '../../../middleware/error-handler';
import { registerProductRoutes } from './product-routes';
import type { Product } from '../schemas/product';
import type { Db } from '../../../config/database';

describe('Product Routes', () => {
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
    registerProductRoutes(server);

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

  const createTestProduct = (overrides?: Partial<Product>): Product => ({
    _id: 'prod-1',
    merchant_id: 'test-merchant-1',
    sku_id: 'SKU001',
    name: 'Test Product',
    category: 'electronics',
    subcategory: 'phones',
    brand: 'TestBrand',
    parent_sku: null,
    attributes: { color: 'black' },
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  });

  describe('POST /api/products', () => {
    it('creates a product with 201 status', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/products',
        headers: { 'x-api-key': 'test-key' },
        payload: {
          sku_id: 'SKU001',
          name: 'New Product',
          category: 'electronics',
          brand: 'TestBrand',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('_id');
      expect(body.sku_id).toBe('SKU001');
      expect(body.name).toBe('New Product');
      expect(body.merchant_id).toBe('test-merchant-1');
    });
  });

  describe('GET /api/products', () => {
    it('lists products with 200 status', async () => {
      const product = createTestProduct();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (testDb.collection('products') as unknown as Collection).insertOne(product as any);

      const response = await server.inject({
        method: 'GET',
        url: '/api/products',
        headers: { 'x-api-key': 'test-key' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body.products)).toBe(true);
      expect(body.products.length).toBe(1);
      expect(body.products[0].sku_id).toBe('SKU001');
    });

    it('filters products by category', async () => {
      const product1 = createTestProduct({ _id: 'prod-1', sku_id: 'SKU001', category: 'electronics' });
      const product2 = createTestProduct({ _id: 'prod-2', sku_id: 'SKU002', category: 'clothing' });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (testDb.collection('products') as unknown as Collection).insertMany([product1 as any, product2 as any]);

      const response = await server.inject({
        method: 'GET',
        url: '/api/products?category=electronics',
        headers: { 'x-api-key': 'test-key' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.products.length).toBe(1);
      expect(body.products[0].category).toBe('electronics');
    });
  });

  describe('DELETE /api/products/:sku_id', () => {
    it('deletes a product with 200 status', async () => {
      const product = createTestProduct({ sku_id: 'SKU001' });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (testDb.collection('products') as unknown as Collection).insertOne(product as any);

      const response = await server.inject({
        method: 'DELETE',
        url: '/api/products/SKU001',
        headers: { 'x-api-key': 'test-key' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.deleted).toBe(true);

      const found = await (testDb.collection('products') as unknown as Collection).findOne({
        merchant_id: 'test-merchant-1',
        sku_id: 'SKU001',
      });
      expect(found).toBeNull();
    });
  });
});
