import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { Product } from '../schemas/product';

const CreateProductSchema = z.object({
  sku_id: z.string().min(1),
  name: z.string().min(1),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  brand: z.string().optional(),
  parent_sku: z.string().nullable().optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
});

const BulkProductsSchema = z.object({
  products: z.array(CreateProductSchema),
});

/**
 * Generates a unique product ID.
 *
 * @returns Unique product ID with format: prod_<timestamp>_<random>
 */
function generateProductId(): string {
  const random = Math.random().toString(36).substring(2, 9);
  return `prod_${Date.now()}_${random}`;
}

/**
 * Registers product CRUD routes for a Fastify instance.
 * Requires server to have db decorator set and auth middleware.
 *
 * @param server - Fastify instance
 */
export function registerProductRoutes(server: FastifyInstance): void {
  /**
   * POST /api/products - Create or update a product (upsert)
   */
  server.post<{ Body: z.infer<typeof CreateProductSchema> }>(
    '/api/products',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const merchantId = request.merchantId;
      if (!merchantId) {
        return reply.code(401).send({ error: { code: 'AUTH_INVALID', message: 'Missing merchant context' } });
      }

      const parseResult = CreateProductSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: parseResult.error.message } });
      }

      const db = server.db;
      if (!db) {
        return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Database not available' } });
      }

      const now = new Date().toISOString();
      const product: Product = {
        _id: generateProductId(),
        merchant_id: merchantId,
        sku_id: parseResult.data.sku_id,
        name: parseResult.data.name,
        category: parseResult.data.category,
        subcategory: parseResult.data.subcategory,
        brand: parseResult.data.brand,
        parent_sku: parseResult.data.parent_sku || null,
        attributes: parseResult.data.attributes || {},
        status: 'active',
        created_at: now,
        updated_at: now,
      };

      await db.collection('products').updateOne(
        { merchant_id: merchantId, sku_id: parseResult.data.sku_id },
        { $set: product },
        { upsert: true },
      );

      // Fetch the actual product from DB to get the correct _id
      const savedProduct = await db.collection('products').findOne({
        merchant_id: merchantId,
        sku_id: parseResult.data.sku_id,
      });

      return reply.code(201).send(savedProduct);
    },
  );

  /**
   * POST /api/products/bulk - Bulk upsert products
   */
  server.post<{ Body: z.infer<typeof BulkProductsSchema> }>(
    '/api/products/bulk',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const merchantId = request.merchantId;
      if (!merchantId) {
        return reply.code(401).send({ error: { code: 'AUTH_INVALID', message: 'Missing merchant context' } });
      }

      const parseResult = BulkProductsSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: parseResult.error.message } });
      }

      const db = server.db;
      if (!db) {
        return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Database not available' } });
      }

      const now = new Date().toISOString();
      const operations = parseResult.data.products.map((product) => ({
        replaceOne: {
          filter: { merchant_id: merchantId, sku_id: product.sku_id },
          replacement: {
            _id: generateProductId(),
            merchant_id: merchantId,
            sku_id: product.sku_id,
            name: product.name,
            category: product.category,
            subcategory: product.subcategory,
            brand: product.brand,
            parent_sku: product.parent_sku || null,
            attributes: product.attributes || {},
            status: 'active',
            created_at: now,
            updated_at: now,
          },
          upsert: true,
        },
      }));

      const result = await db.collection('products').bulkWrite(operations as any);

      return reply.code(200).send({
        upserted: result.upsertedCount,
        matched: result.matchedCount,
        modified: result.modifiedCount,
      });
    },
  );

  /**
   * GET /api/products - List products for a merchant
   */
  server.get(
    '/api/products',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const merchantId = request.merchantId;
      if (!merchantId) {
        return reply.code(401).send({ error: { code: 'AUTH_INVALID', message: 'Missing merchant context' } });
      }

      const db = server.db;
      if (!db) {
        return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Database not available' } });
      }

      const query: Record<string, unknown> = { merchant_id: merchantId };
      const category = (request.query as Record<string, unknown>).category;
      if (category) {
        query.category = category;
      }

      const products = await db.collection('products').find(query).toArray();

      return reply.code(200).send({ products });
    },
  );

  /**
   * DELETE /api/products/:sku_id - Delete a product
   */
  server.delete(
    '/api/products/:sku_id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const merchantId = request.merchantId;
      if (!merchantId) {
        return reply.code(401).send({ error: { code: 'AUTH_INVALID', message: 'Missing merchant context' } });
      }

      const db = server.db;
      if (!db) {
        return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Database not available' } });
      }

      const sku_id = (request.params as Record<string, unknown>).sku_id as string;

      const result = await db.collection('products').deleteOne({
        merchant_id: merchantId,
        sku_id,
      });

      return reply.code(200).send({ deleted: result.deletedCount > 0 });
    },
  );
}
