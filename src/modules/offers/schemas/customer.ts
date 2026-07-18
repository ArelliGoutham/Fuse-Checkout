import { z } from 'zod';

export const CustomerContextSchema = z.object({
  customer_id: z.string().min(1),
  segments: z.array(z.string()),
  total_orders: z.number().int().nonnegative(),
  per_customer_used: z.number().int().nonnegative(),
});

export type CustomerContext = z.infer<typeof CustomerContextSchema>;
