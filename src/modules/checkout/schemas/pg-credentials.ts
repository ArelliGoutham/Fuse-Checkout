import { z } from 'zod';

export const PGCredentialsSchema = z.object({
  _id: z.string(),
  merchant_id: z.string(),
  pg_name: z.string().min(1),
  api_key_encrypted: z.string(),
  api_secret_encrypted: z.string(),
  webhook_secret_encrypted: z.string().nullable(),
  status: z.enum(['active', 'inactive']).default('active'),
  test_mode: z.boolean().default(true),
  connected_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const SavePGCredentialsSchema = z.object({
  pg_name: z.string().min(1),
  api_key: z.string().min(1),
  api_secret: z.string().min(1),
  webhook_secret: z.string().optional(),
  test_mode: z.boolean().default(true),
});

export type PGCredentials = z.infer<typeof PGCredentialsSchema>;
export type SavePGCredentialsInput = z.infer<typeof SavePGCredentialsSchema>;
