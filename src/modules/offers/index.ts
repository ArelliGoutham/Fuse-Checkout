import { OfferEvaluatorRegistry } from './evaluators';
import { CouponEvaluator } from './evaluators/coupon-evaluator';
import { AutoOfferEvaluator } from './evaluators/auto-offer-evaluator';
import { RuleEvaluatorRegistry } from './rules';
import { ComboResolver } from './combo';
import { minCartValue } from './rules/min-cart-value';
import { maxCartValue } from './rules/max-cart-value';
import { customerSegment } from './rules/customer-segment';
import { firstTimeBuyer } from './rules/first-time-buyer';
import { perCustomerLimit } from './rules/per-customer-limit';
import { totalUsageLimit } from './rules/total-usage-limit';
import { categoryRestriction } from './rules/category-restriction';
import { productRestriction } from './rules/product-restriction';
import { brandRestriction } from './rules/brand-restriction';
import { productCombo } from './rules/product-combo';
import { timeWindow } from './rules/time-window';
import { weekendOnly } from './rules/weekend-only';
import { dateRange } from './rules/date-range';
import type { OfferService } from './types';
import type { Offer } from './schemas/offer';
import type { EvaluationContext, EvaluationResult, StackingPolicy } from './schemas/evaluation';
import type { ComboResult } from './schemas/combo';

// PUBLIC: only export interfaces and types
export type { OfferService, OfferRepository } from './types';
export type { Offer, Rule } from './schemas/offer';
export type { EvaluationContext, EvaluationResult, StackingPolicy, ComputedDiscount } from './schemas/evaluation';
export type { ComboResult, AppliedOffer, RejectedOffer } from './schemas/combo';
export type { Cart, CartItem } from './schemas/cart';
export type { CustomerContext } from './schemas/customer';
export type { Discount } from './schemas/discount';

export function createOfferModule(): OfferService {
  const ruleRegistry = new RuleEvaluatorRegistry();
  ruleRegistry.register('min_cart_value', minCartValue);
  ruleRegistry.register('max_cart_value', maxCartValue);
  ruleRegistry.register('customer_segment', customerSegment);
  ruleRegistry.register('first_time_buyer', firstTimeBuyer);
  ruleRegistry.register('per_customer_limit', perCustomerLimit);
  ruleRegistry.register('total_usage_limit', totalUsageLimit);
  ruleRegistry.register('category_restriction', categoryRestriction);
  ruleRegistry.register('product_restriction', productRestriction);
  ruleRegistry.register('brand_restriction', brandRestriction);
  ruleRegistry.register('product_combo', productCombo);
  ruleRegistry.register('time_window', timeWindow);
  ruleRegistry.register('weekend_only', weekendOnly);
  ruleRegistry.register('date_range', dateRange);

  const offerRegistry = new OfferEvaluatorRegistry();
  offerRegistry.register('coupon', new CouponEvaluator(ruleRegistry));
  offerRegistry.register('auto_offer', new AutoOfferEvaluator(ruleRegistry));

  const comboResolver = new ComboResolver();

  return {
    evaluate: (offer: Offer, context: EvaluationContext): EvaluationResult =>
      offerRegistry.evaluate(offer, context),

    evaluateEligible: (offers: Offer[], context: EvaluationContext) =>
      offerRegistry.evaluateEligible(offers, context),

    resolveCombo: (eligibleOffers, policy: StackingPolicy, cartAmount: number): ComboResult => {
      const inputs = eligibleOffers.map(({ offer, result }) => ({ offer, result }));
      return comboResolver.resolve(inputs, policy, cartAmount);
    },
  };
}
