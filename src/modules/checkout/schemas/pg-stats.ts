import { z } from 'zod';

export const PGStatsSchema = z.object({
  _id: z.string(),
  pg_name: z.string(),
  merchant_id: z.string(),
  date: z.string(),

  total_attempts: z.number().int(),
  successful: z.number().int(),
  failed: z.number().int(),
  pending: z.number().int(),

  success_rate: z.number(),
  avg_latency_ms: z.number(),
  p95_latency_ms: z.number(),

  total_volume: z.number(),
  avg_order_value: z.number(),

  failures_by_reason: z.record(z.string(), z.number()),

  updated_at: z.string().datetime(),
});

export type PGStats = z.infer<typeof PGStatsSchema>;
