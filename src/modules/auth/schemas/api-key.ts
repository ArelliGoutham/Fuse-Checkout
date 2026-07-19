import { z } from 'zod';

/**
 * Schema for an API key record in the database.
 */
export const ApiKeySchema = z.object({
  _id: z.string(),
  merchant_id: z.string(),
  key_hash: z.string(),
  label: z.string(),
  scopes: z.array(z.enum([
    'offers:read',
    'offers:write',
    'analytics:read',
    'products:read',
    'products:write',
    'checkout',
    'tracking',
  ])),
  status: z.enum(['active', 'revoked']),
  last_used_at: z.string().datetime().nullable(),
  created_by: z.string(),
  created_at: z.string().datetime(),
  revoked_at: z.string().datetime().nullable(),
});

/**
 * Schema for creating an API key (input validation).
 */
export const CreateApiKeySchema = z.object({
  label: z.string().min(1).max(50),
  scopes: z.array(z.string()),
});

export type ApiKey = z.infer<typeof ApiKeySchema>;
export type CreateApiKeyInput = z.infer<typeof CreateApiKeySchema>;
