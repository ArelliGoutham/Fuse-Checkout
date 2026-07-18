import type { Offer } from '../schemas/offer';
import type { EvaluationContext, EvaluationResult } from '../schemas/evaluation';

export interface OfferEvaluator {
  evaluate(offer: Offer, context: EvaluationContext): EvaluationResult;
}
