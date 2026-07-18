import { z } from 'zod';
import { CartSchema } from './cart';
import { CustomerContextSchema } from './customer';
import { DiscountSchema } from './discount';

export const StackingPolicySchema = z.object({
  max_coupons: z.number().int().positive(),
  max_auto_offers: z.number().int().positive(),
  max_total_discount: z.number().positive().nullable(),
  allow_cross_type: z.boolean(),
  exclusive_tags: z.array(z.string()),
});

export const EvaluationContextSchema = z.object({
  cart: CartSchema,
  customer: CustomerContextSchema,
  merchant: z.object({
    stacking_policy: StackingPolicySchema,
  }),
  usage: z.object({
    per_customer_used: z.number().int().nonnegative(),
    total_used: z.number().int().nonnegative(),
  }),
  now: z.string().datetime(),
});

export const ComputedDiscountSchema = DiscountSchema.extend({
  amount: z.number().nonnegative(),
});

export const EvaluationResultSchema = z.object({
  eligible: z.boolean(),
  matched_rules: z.array(z.string()),
  failed_rule: z.string().nullable(),
  reason: z.string().nullable(),
  discount: ComputedDiscountSchema.nullable(),
});

export type EvaluationContext = z.infer<typeof EvaluationContextSchema>;
export type EvaluationResult = z.infer<typeof EvaluationResultSchema>;
export type StackingPolicy = z.infer<typeof StackingPolicySchema>;
export type ComputedDiscount = z.infer<typeof ComputedDiscountSchema>;
