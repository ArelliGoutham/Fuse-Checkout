import { z } from 'zod';

export const BankRateSchema = z.object({
  _id: z.string(),
  bank_name: z.string().min(1),
  bank_code: z.string().min(1),
  card_type: z.enum(['credit', 'debit']),
  interest_rate: z.number().positive(),
  tenures: z.array(z.number().int().positive()),
  processing_fee: z.number().nullable(),
  min_amount: z.number().positive(),
  max_amount: z.number().nullable(),
  status: z.enum(['active', 'inactive']),
  updated_at: z.string().datetime(),
});

export const CreateBankRateSchema = z.object({
  bank_name: z.string().min(1),
  bank_code: z.string().min(1),
  card_type: z.enum(['credit', 'debit']),
  interest_rate: z.number().positive(),
  tenures: z.array(z.number().int().positive()),
  processing_fee: z.number().nullable(),
  min_amount: z.number().positive().default(2500),
  max_amount: z.number().nullable().default(null),
});

export type BankRate = z.infer<typeof BankRateSchema>;
export type CreateBankRateInput = z.infer<typeof CreateBankRateSchema>;
