import { z } from 'zod';

export const AppliedOfferSchema = z.object({
  offer_id: z.string(),
  discount_amount: z.number().nonnegative(),
});

export const RejectedOfferSchema = z.object({
  offer_id: z.string(),
  reason: z.string(),
});

export const ComboResultSchema = z.object({
  applied: z.array(AppliedOfferSchema),
  rejected: z.array(RejectedOfferSchema),
  total_discount: z.number().nonnegative(),
  final_amount: z.number().nonnegative(),
});

export type AppliedOffer = z.infer<typeof AppliedOfferSchema>;
export type RejectedOffer = z.infer<typeof RejectedOfferSchema>;
export type ComboResult = z.infer<typeof ComboResultSchema>;
