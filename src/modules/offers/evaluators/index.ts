import type { Offer } from '../schemas/offer';
import type { EvaluationContext, EvaluationResult } from '../schemas/evaluation';
import type { OfferEvaluator } from './types';

export class OfferEvaluatorRegistry {
  private evaluators = new Map<string, OfferEvaluator>();

  register(offerType: string, evaluator: OfferEvaluator): void {
    this.evaluators.set(offerType, evaluator);
  }

  has(offerType: string): boolean {
    return this.evaluators.has(offerType);
  }

  evaluate(offer: Offer, context: EvaluationContext): EvaluationResult {
    const evaluator = this.evaluators.get(offer.type);
    if (!evaluator) {
      throw new Error(`No evaluator registered for offer type: ${offer.type}`);
    }
    return evaluator.evaluate(offer, context);
  }

  evaluateEligible(
    offers: Offer[],
    context: EvaluationContext,
  ): Array<{ offer: Offer; result: EvaluationResult }> {
    return offers
      .map((offer) => ({ offer, result: this.evaluate(offer, context) }))
      .filter(({ result }) => result.eligible);
  }
}

export type { OfferEvaluator } from './types';
