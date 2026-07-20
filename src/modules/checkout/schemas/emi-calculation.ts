import { z } from 'zod';

export const EMICalculationSchema = z.object({
  principal: z.number().positive(),
  tenure_months: z.number().int().positive(),
  interest_rate: z.number().nonnegative(),
  monthly_emi: z.number().nonnegative(),
  total_payment: z.number().nonnegative(),
  total_interest: z.number().nonnegative(),
  customer_emi: z.number().nonnegative(),
  customer_interest: z.number().nonnegative(),
  customer_total: z.number().nonnegative(),
  subsidy_amount: z.number().nonnegative(),
  emi_type: z.enum(['standard', 'no_cost', 'low_cost']),
  bank: z.string(),
  processing_fee: z.number().nullable(),
});

export type EMICalculation = z.infer<typeof EMICalculationSchema>;
