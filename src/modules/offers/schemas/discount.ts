import { z } from 'zod';

export const DiscountSchema = z.object({
  type: z.enum(['flat', 'percentage']),
  value: z.number().positive(),
  max_discount: z.number().positive().nullable(),
}).refine(
  (data) => {
    if (data.type === 'percentage') {
      return data.value <= 100;
    }
    return true;
  },
  {
    message: 'Percentage discount cannot exceed 100',
    path: ['value'],
  }
);

export type Discount = z.infer<typeof DiscountSchema>;

/**
 * Computes the actual discount amount for a given cart amount.
 * @param discount - Discount configuration
 * @param cartAmount - Total cart amount in rupees
 * @returns Discount amount in whole rupees
 */
export function computeDiscount(discount: Discount, cartAmount: number): number {
  if (discount.type === 'flat') {
    return Math.min(discount.value, cartAmount);
  }

  const percentageAmount = Math.round((cartAmount * discount.value) / 100);

  if (discount.max_discount !== null) {
    return Math.min(percentageAmount, discount.max_discount);
  }

  return percentageAmount;
}
