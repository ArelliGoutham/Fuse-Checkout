import { z } from 'zod';

export const SessionAuditLogSchema = z.object({
  _id: z.string(),
  session_id: z.string(),
  merchant_id: z.string(),
  action: z.enum([
    'created',
    'cart_updated',
    'customer_saved',
    'payment_initiated',
    'payment_success',
    'payment_failed',
    'expired',
    'retried',
  ]),
  previous_state: z.string(),
  new_state: z.string(),
  changed_by: z.enum(['merchant', 'customer', 'system']),
  metadata: z.record(z.string(), z.unknown()).default({}),
  timestamp: z.string().datetime(),
});

export type SessionAuditLog = z.infer<typeof SessionAuditLogSchema>;
