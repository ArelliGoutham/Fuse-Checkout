import type { Offer } from '../schemas/offer';
import type { EvaluationContext, EvaluationResult } from '../schemas/evaluation';
import type { OfferEvaluator } from './types';
import type { RuleEvaluatorRegistry } from '../rules';
import { computeDiscount } from '../schemas/discount';

/**
 * Evaluator for bank offers — discounts tied to specific cards/banks.
 * Uses the same rule engine as coupon/auto_offer, but always requires
 * a payment_method_restriction rule that checks card BIN, bank, and tier.
 *
 * Example: "10% off with HDFC Platinum Credit Card"
 * - Rule: payment_method_restriction { payment_types: ["card"], banks: ["HDFC"], card_tiers: ["platinum"] }
 * - Discount: percentage 10%, max ₹500
 * - Subsidy model: bank (bank pays the discount, not merchant)
 *
 * If no payment context is provided (customer hasn't entered card yet),
 * the evaluator returns ineligible — bank offers can only be validated
 * after the customer selects a payment method.
 */
export class BankOfferEvaluator implements OfferEvaluator {
  constructor(private readonly ruleRegistry: RuleEvaluatorRegistry) {}

  evaluate(offer: Offer, context: EvaluationContext): EvaluationResult {
    if (offer.status !== 'active') {
      return this.ineligible(`Offer is ${offer.status}`);
    }

    const now = new Date(context.now);
    const startsAt = new Date(offer.validity.starts_at);
    const endsAt = new Date(offer.validity.ends_at);

    if (now < startsAt) {
      return this.ineligible('Offer is not yet valid');
    }
    if (now > endsAt) {
      return this.ineligible('Offer has expired');
    }

    if (offer.usage_limits.total !== null && offer.usage_count >= offer.usage_limits.total) {
      return this.ineligible('Total usage limit reached');
    }

    if (
      offer.usage_limits.per_customer !== null &&
      context.usage.per_customer_used >= offer.usage_limits.per_customer
    ) {
      return this.ineligible('per customer usage limit reached');
    }

    // Bank offers require payment context — can't evaluate without card info
    if (!context.payment) {
      return this.ineligible('Payment method not selected yet');
    }

    const ruleResult = this.ruleRegistry.evaluateAll(offer.rules, context);
    if (!ruleResult.passed) {
      return {
        eligible: false,
        matched_rules: [],
        failed_rule: ruleResult.failedRuleType,
        reason: `Rule failed: ${ruleResult.failedRuleType}`,
        discount: null,
      };
    }

    const discountAmount = computeDiscount(offer.discount, context.cart.amount);
    return {
      eligible: true,
      matched_rules: offer.rules.map((r) => r.rule_type),
      failed_rule: null,
      reason: null,
      discount: { ...offer.discount, amount: discountAmount },
    };
  }

  private ineligible(reason: string): EvaluationResult {
    return { eligible: false, matched_rules: [], failed_rule: null, reason, discount: null };
  }
}
