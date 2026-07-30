import { z } from 'zod';

export const CheckoutSessionSchema = z.object({
  _id: z.string(),
  merchant_id: z.string(),
  merchant_order_id: z.string().nullable().default(null),
  original_session_id: z.string().nullable().default(null),
  cart: z.object({
    amount: z.number().positive(),
    items: z.array(
      z.object({
        sku_id: z.string(),
        name: z.string(),
        price: z.number().positive(),
        qty: z.number().int().positive(),
        category: z.string().optional(),
        brand: z.string().optional(),
      })
    ),
  }),
  customer: z
    .object({
      email: z.string().optional(),
      phone: z.string().optional(),
    })
    .nullable(),
  customer_info: z
    .object({
      name: z.string(),
      email: z.string(),
      phone: z.string(),
      address: z.object({
        line1: z.string(),
        city: z.string(),
        state: z.string(),
        pincode: z.string(),
      }),
    })
    .nullable(),
  applied_offers: z
    .array(
      z.object({
        offer_id: z.string(),
        type: z.string(),
        discount_amount: z.number(),
      })
    )
    .default([]),
  payment_method: z.string().nullable(),
  payment_status: z
    .enum(['pending', 'processing', 'success', 'failed', 'expired'])
    .default('pending'),
  pg_transaction_id: z.string().nullable(),
  order_id: z.string().nullable(),
  redirect_urls: z.object({
    success: z.string(),
    cancel: z.string(),
  }),
  created_at: z.string().datetime(),
  expires_at: z.string().datetime(),
});

export const CreateSessionSchema = z.object({
  cart: z.object({
    amount: z.number().positive(),
    items: z.array(
      z.object({
        sku_id: z.string(),
        name: z.string(),
        price: z.number().positive(),
        qty: z.number().int().positive(),
        category: z.string().optional(),
        brand: z.string().optional(),
      })
    ),
  }),
  redirect_urls: z.object({
    success: z.string().url(),
    cancel: z.string().url(),
  }),
  customer: z
    .object({
      email: z.string().optional(),
      phone: z.string().optional(),
    })
    .optional(),
  merchant_order_id: z.string().optional(),
});

export type CheckoutSession = z.infer<typeof CheckoutSessionSchema>;
export type CreateSessionInput = z.infer<typeof CreateSessionSchema>;
