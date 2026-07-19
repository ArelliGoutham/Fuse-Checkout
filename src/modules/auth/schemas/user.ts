import { z } from 'zod';

/**
 * Schema for a user record in the database.
 */
export const UserSchema = z.object({
  _id: z.string(),
  email: z.string().email(),
  password_hash: z.string(),
  name: z.string(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

/**
 * Schema for signup input validation.
 */
export const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  store_name: z.string().min(1),
});

/**
 * Schema for login input validation.
 */
export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type User = z.infer<typeof UserSchema>;
export type SignupInput = z.infer<typeof SignupSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
