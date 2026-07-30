import { z } from 'zod';
import { DiscountSchema } from './discount';

export const RuleSchema = z.object({
  rule_type: z.enum([
    'min_cart_value', 'max_cart_value', 'customer_segment', 'first_time_buyer',
    'per_customer_limit', 'total_usage_limit', 'category_restriction',
    'product_restriction', 'brand_restriction', 'product_combo',
    'time_window', 'weekend_only', 'date_range',
    'payment_method_restriction',
  ]),
  config: z.record(z.string(), z.unknown()),
});

export const OfferSchema = z.object({
  _id: z.string(),
  merchant_id: z.string(),
  code: z.string().nullable(),
  type: z.enum(['coupon', 'auto_offer', 'bank_offer']),
  title: z.string(),
  description: z.string().optional(),
  discount: DiscountSchema,
  subsidy_model: z.enum(['merchant', 'bank', 'brand', 'split']).default('merchant'),
  status: z.enum(['active', 'inactive', 'expired']),
  validity: z.object({
    starts_at: z.string().datetime(),
    ends_at: z.string().datetime(),
  }),
  usage_limits: z.object({
    total: z.number().int().positive().nullable(),
    per_customer: z.number().int().positive().nullable(),
  }),
  usage_count: z.number().int().nonnegative().default(0),
  rules: z.array(RuleSchema),
  stacking: z.object({
    stacks_with: z.array(z.string()).nullable(),
    exclusive: z.boolean().default(false),
    priority: z.number().int().default(0),
  }).default({ stacks_with: null, exclusive: false, priority: 0 }),
  tags: z.array(z.string()).default([]),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Rule = z.infer<typeof RuleSchema>;
export type Offer = z.infer<typeof OfferSchema>;
