import { z } from 'zod';

export const OrderSchema = z.object({
  _id: z.string(),
  merchant_id: z.string(),
  session_id: z.string(),
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
  pg_transaction_id: z.string().nullable(),
  pg_name: z.string(),
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
});

export type Order = z.infer<typeof OrderSchema>;
