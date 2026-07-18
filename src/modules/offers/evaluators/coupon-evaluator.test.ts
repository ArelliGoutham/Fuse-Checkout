import { CouponEvaluator } from './coupon-evaluator';
import { RuleEvaluatorRegistry } from '../rules';
import { minCartValue } from '../rules/min-cart-value';
import type { Offer } from '../schemas/offer';
import type { EvaluationContext } from '../schemas/evaluation';

function makeOffer(overrides: Partial<Offer> = {}): Offer {
  return {
    _id: 'offer_1',
    merchant_id: 'merch_1',
    code: 'FLAT50',
    type: 'coupon',
    title: 'Flat 50 off',
    discount: { type: 'flat', value: 50, max_discount: null },
    subsidy_model: 'merchant',
    status: 'active',
    validity: { starts_at: '2026-01-01T00:00:00.000Z', ends_at: '2026-12-31T23:59:59.000Z' },
    usage_limits: { total: null, per_customer: null },
    usage_count: 0,
    rules: [],
    stacking: { stacks_with: null, exclusive: false, priority: 0 },
    tags: [],
    created_at: '2026-07-18T09:00:00.000Z',
    updated_at: '2026-07-18T09:00:00.000Z',
    ...overrides,
  };
}

function makeContext(overrides: Partial<EvaluationContext> = {}): EvaluationContext {
  return {
    cart: { amount: 5000, items: [{ sku_id: 'SKU-1', price: 5000, qty: 1 }] },
    customer: { customer_id: 'c1', segments: [], total_orders: 0, per_customer_used: 0 },
    merchant: {
      stacking_policy: {
        max_coupons: 1,
        max_auto_offers: 1,
        max_total_discount: null,
        allow_cross_type: true,
        exclusive_tags: [],
      },
    },
    usage: { per_customer_used: 0, total_used: 0 },
    now: '2026-07-18T10:00:00.000Z',
    ...overrides,
  };
}

function makeEvaluatorWithRules(): CouponEvaluator {
  const ruleRegistry = new RuleEvaluatorRegistry();
  ruleRegistry.register('min_cart_value', minCartValue);
  return new CouponEvaluator(ruleRegistry);
}

describe('CouponEvaluator', () => {
  it('returns eligible with discount when all checks pass', () => {
    const evaluator = makeEvaluatorWithRules();
    const result = evaluator.evaluate(makeOffer(), makeContext());
    expect(result.eligible).toBe(true);
    expect(result.discount?.amount).toBe(50);
    expect(result.failed_rule).toBeNull();
    expect(result.reason).toBeNull();
  });

  it('returns ineligible when status is inactive', () => {
    const evaluator = makeEvaluatorWithRules();
    const result = evaluator.evaluate(makeOffer({ status: 'inactive' }), makeContext());
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('inactive');
  });

  it('returns ineligible when status is expired', () => {
    const evaluator = makeEvaluatorWithRules();
    const result = evaluator.evaluate(makeOffer({ status: 'expired' }), makeContext());
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('expired');
  });

  it('returns ineligible when now is before validity starts_at', () => {
    const evaluator = makeEvaluatorWithRules();
    const offer = makeOffer({
      validity: { starts_at: '2026-12-01T00:00:00.000Z', ends_at: '2026-12-31T23:59:59.000Z' },
    });
    const result = evaluator.evaluate(offer, makeContext({ now: '2026-07-18T10:00:00.000Z' }));
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('not yet valid');
  });

  it('returns ineligible when now is after validity ends_at', () => {
    const evaluator = makeEvaluatorWithRules();
    const offer = makeOffer({
      validity: { starts_at: '2026-01-01T00:00:00.000Z', ends_at: '2026-06-30T23:59:59.000Z' },
    });
    const result = evaluator.evaluate(offer, makeContext({ now: '2026-07-18T10:00:00.000Z' }));
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('expired');
  });

  it('returns ineligible when total usage limit is reached', () => {
    const evaluator = makeEvaluatorWithRules();
    const offer = makeOffer({ usage_limits: { total: 100, per_customer: null }, usage_count: 100 });
    const result = evaluator.evaluate(offer, makeContext());
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('usage limit');
  });

  it('returns ineligible when a rule fails', () => {
    const evaluator = makeEvaluatorWithRules();
    const offer = makeOffer({
      rules: [{ rule_type: 'min_cart_value', config: { min_amount: 10000 } }],
    });
    const result = evaluator.evaluate(offer, makeContext({ cart: { amount: 5000, items: [] } }));
    expect(result.eligible).toBe(false);
    expect(result.failed_rule).toBe('min_cart_value');
    expect(result.reason).toContain('min_cart_value');
  });

  it('computes percentage discount correctly', () => {
    const evaluator = makeEvaluatorWithRules();
    const offer = makeOffer({ discount: { type: 'percentage', value: 10, max_discount: null } });
    const result = evaluator.evaluate(offer, makeContext({ cart: { amount: 5000, items: [] } }));
    expect(result.eligible).toBe(true);
    expect(result.discount?.amount).toBe(500);
  });

  it('computes percentage discount with max cap', () => {
    const evaluator = makeEvaluatorWithRules();
    const offer = makeOffer({ discount: { type: 'percentage', value: 10, max_discount: 300 } });
    const result = evaluator.evaluate(offer, makeContext({ cart: { amount: 5000, items: [] } }));
    expect(result.eligible).toBe(true);
    expect(result.discount?.amount).toBe(300);
  });

  it('handles per_customer_limit via usage context', () => {
    const ruleRegistry = new RuleEvaluatorRegistry();
    ruleRegistry.register('min_cart_value', minCartValue);
    const evaluator = new CouponEvaluator(ruleRegistry);
    const offer = makeOffer({ usage_limits: { total: null, per_customer: 2 } });
    const result = evaluator.evaluate(
      offer,
      makeContext({ usage: { per_customer_used: 2, total_used: 0 } }),
    );
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('per customer');
  });
});
