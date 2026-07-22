import { z } from 'zod';

export const EMICampaignSchema = z.object({
  _id: z.string(),
  code: z.string().min(1),
  title: z.string().min(1),
  scope: z.enum(['merchant', 'brand']),
  merchant_id: z.string().nullable(),
  brand: z.string().nullable(),
  bank: z.string().min(1),
  iin_prefixes: z.array(z.string().length(6)),
  card_tiers: z.array(z.string()),
  emi_type: z.enum(['no_cost', 'low_cost']),
  products: z.array(z.string()).nullable(),
  max_total: z.number().int().positive(),
  max_per_merchant: z.number().int().positive().nullable(),
  max_per_card: z.number().int().positive(),
  subsidy_amount: z.number().nonnegative().nullable(),
  requires_imei: z.boolean().default(false),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  status: z.enum(['active', 'inactive']).default('active'),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const CreateEMICampaignSchema = z.object({
  code: z.string().min(1),
  title: z.string().min(1),
  scope: z.enum(['merchant', 'brand']),
  merchant_id: z.string().nullable().default(null),
  brand: z.string().nullable().default(null),
  bank: z.string().min(1),
  iin_prefixes: z.array(z.string().length(6)).min(1),
  card_tiers: z.array(z.string()).min(1),
  emi_type: z.enum(['no_cost', 'low_cost']),
  products: z.array(z.string()).nullable().default(null),
  max_total: z.number().int().positive(),
  max_per_merchant: z.number().int().positive().nullable().default(null),
  max_per_card: z.number().int().positive().default(2),
  subsidy_amount: z.number().nonnegative().nullable().default(null),
  requires_imei: z.boolean().default(false),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
});

export type EMICampaign = z.infer<typeof EMICampaignSchema>;
export type CreateEMICampaignInput = z.infer<typeof CreateEMICampaignSchema>;
