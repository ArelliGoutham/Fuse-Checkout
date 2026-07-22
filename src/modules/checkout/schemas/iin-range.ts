import { z } from 'zod';

export const IINRangeSchema = z.object({
  _id: z.string().optional(),
  prefix: z.string().length(6).regex(/^\d+$/, 'Must be 6-digit numeric prefix'),
  bank_code: z.string().min(1),
  bank_name: z.string().min(1),
  card_type: z.enum(['credit', 'debit']),
  card_tier: z.enum([
    'standard', 'gold', 'platinum', 'signature', 'world', 'infinite',
    'select', 'coral', 'rubyx', 'sapphire', 'magnus', 'white', 'elite',
    'business', 'corporate', 'prepaid',
  ]),
  card_network: z.enum(['visa', 'mastercard', 'rupay', 'amex', 'diners']),
  status: z.enum(['active', 'inactive']).default('active'),
  updated_at: z.string().datetime().optional(),
});

export const CreateIINRangeSchema = z.object({
  prefix: z.string().length(6).regex(/^\d+$/, 'Must be 6-digit numeric prefix'),
  bank_code: z.string().min(1),
  bank_name: z.string().min(1),
  card_type: z.enum(['credit', 'debit']),
  card_tier: z.enum([
    'standard', 'gold', 'platinum', 'signature', 'world', 'infinite',
    'select', 'coral', 'rubyx', 'sapphire', 'magnus', 'white', 'elite',
    'business', 'corporate', 'prepaid',
  ]).default('standard'),
  card_network: z.enum(['visa', 'mastercard', 'rupay', 'amex', 'diners']).default('visa'),
});

export type IINRange = z.infer<typeof IINRangeSchema>;
export type CreateIINRangeInput = z.infer<typeof CreateIINRangeSchema>;
