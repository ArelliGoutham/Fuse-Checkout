import { z } from 'zod';

/**
 * Schema for a single item in a shopping cart.
 */
export const CartItemSchema = z.object({
  sku_id: z.string().min(1),
  category: z.string().optional(),
  brand: z.string().optional(),
  price: z.number().positive(),
  qty: z.number().int().positive(),
});

export const CartSchema = z.object({
  amount: z.number().nonnegative(),
  items: z.array(CartItemSchema),
});

export type CartItem = z.infer<typeof CartItemSchema>;
export type Cart = z.infer<typeof CartSchema>;
