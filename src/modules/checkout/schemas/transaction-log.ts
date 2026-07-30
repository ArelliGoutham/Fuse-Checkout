import { z } from 'zod';

export const TransactionLogSchema = z.object({
  _id: z.string(),
  order_id: z.string(),
  session_id: z.string(),
  merchant_id: z.string(),
  merchant_order_id: z.string().nullable(),

  attempt_number: z.number().int().positive(),
  pg_name: z.string(),
  pg_order_id: z.string().nullable(),
  pg_payment_id: z.string().nullable(),
  pg_status: z.string(),
  pg_error_code: z.string().nullable(),
  pg_error_message: z.string().nullable(),
  pg_raw_request: z.record(z.string(), z.unknown()),
  pg_raw_response: z.record(z.string(), z.unknown()).nullable(),

  amount: z.number().positive(),
  payment_method: z.string(),
  payment_status: z.enum(['success', 'failed', 'pending']),

  routing_reason: z.string(),
  is_fallback: z.boolean().default(false),

  initiated_at: z.string().datetime(),
  completed_at: z.string().datetime().nullable(),
  latency_ms: z.number().nullable(),

  created_at: z.string().datetime(),
});

export type TransactionLog = z.infer<typeof TransactionLogSchema>;
