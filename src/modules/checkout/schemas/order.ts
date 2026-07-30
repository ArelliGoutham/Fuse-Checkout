import { z } from 'zod';

export const OrderSchema = z.object({
  _id: z.string(),
  merchant_id: z.string(),
  session_id: z.string(),
  merchant_order_id: z.string().nullable().default(null),
  cart_amount: z.number(),
  total_discount: z.number(),
  final_amount: z.number(),
  customer_info: z.object({
    name: z.string(),
    email: z.string(),
    phone: z.string(),
    address: z.object({
      line1: z.string(),
      city: z.string(),
      state: z.string(),
      pincode: z.string(),
    }),
  }),
  applied_offers: z.array(
    z.object({
      offer_id: z.string(),
      type: z.string(),
      discount_amount: z.number(),
    })
  ),
  payment_method: z.string(),
  pg_name: z.string().default('mock'),
  pg_order_id: z.string().nullable().default(null),
  pg_payment_id: z.string().nullable().default(null),
  pg_raw_response: z.record(z.string(), z.unknown()).nullable().default(null),
  pg_refund_id: z.string().nullable().optional(),
  pg_transaction_id: z.string().nullable(),
  order_status: z.enum(['created', 'paid', 'failed', 'refunded']),
  emi_details: z
    .object({
      bank: z.string(),
      tenure: z.number(),
      emi_amount: z.number(),
      interest: z.number(),
      subsidy: z.number(),
    })
    .nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().optional(),
});

export type Order = z.infer<typeof OrderSchema>;
