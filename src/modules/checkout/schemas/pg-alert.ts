import { z } from 'zod';

export const PGAlertSchema = z.object({
  _id: z.string(),
  type: z.enum([
    'success_rate_drop',
    'latency_spike',
    'pg_downtime',
    'high_failure_rate',
    'anomaly_spike',
  ]),
  severity: z.enum(['critical', 'warning', 'info']),
  pg_name: z.string(),
  merchant_id: z.string(),
  threshold: z.number(),
  actual_value: z.number(),
  message: z.string(),
  error_code: z.string().nullable().optional(),
  error_count: z.number().int().optional(),
  status: z.enum(['active', 'dismissed', 'resolved']).default('active'),
  created_at: z.string().datetime(),
  dismissed_at: z.string().datetime().nullable().default(null),
  dismissed_by: z.string().nullable().default(null),
  window_minutes: z.number().int().optional(),
});

export type PGAlert = z.infer<typeof PGAlertSchema>;
