import type { Offer } from '../schemas/offer';
import type { EvaluationContext, EvaluationResult, StackingPolicy } from '../schemas/evaluation';
import type { ComboResult } from '../schemas/combo';

export interface OfferService {
  evaluate(offer: Offer, context: EvaluationContext): EvaluationResult;
  evaluateEligible(offers: Offer[], context: EvaluationContext): Array<{ offer: Offer; result: EvaluationResult }>;
  resolveCombo(
    eligibleOffers: Array<{ offer: Offer; result: EvaluationResult }>,
    policy: StackingPolicy,
    cartAmount: number,
  ): ComboResult;
}

export interface OfferRepository {
  findById(id: string, merchantId: string): Promise<Offer | null>;
  findByCode(code: string, merchantId: string): Promise<Offer | null>;
  findByMerchant(merchantId: string): Promise<Offer[]>;
  save(offer: Offer): Promise<Offer>;
  delete(id: string, merchantId: string): Promise<boolean>;
}
