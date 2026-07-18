import { z } from 'zod';

export const ProductSchema = z.object({
  _id: z.string(),
  merchant_id: z.string(),
  sku_id: z.string().min(1),
  name: z.string().min(1),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  brand: z.string().optional(),
  parent_sku: z.string().nullable().optional(),
  attributes: z.record(z.string(), z.unknown()).default({}),
  status: z.enum(['active', 'inactive']).default('active'),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Product = z.infer<typeof ProductSchema>;
