import { z } from 'zod';

export const SubsidyLedgerSchema = z.object({
  _id: z.string(),
  order_id: z.string(),
  merchant_id: z.string(),
  campaign_id: z.string(),
  campaign_code: z.string(),
  brand: z.string().nullable(),
  amount: z.number().positive(),
  emi_type: z.enum(['no_cost', 'low_cost']),
  imei: z.string().nullable(),
  imei_blocked: z.boolean().default(false),
  imei_blocked_at: z.string().datetime().nullable(),
  settlement_status: z.enum([
    'pending', 'imei_blocked', 'settled', 'paid', 'disputed',
  ]).default('pending'),
  settlement_ref: z.string().nullable(),
  settled_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type SubsidyLedger = z.infer<typeof SubsidyLedgerSchema>;
