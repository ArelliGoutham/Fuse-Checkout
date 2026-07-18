import { AutoOfferEvaluator } from './auto-offer-evaluator';
import { RuleEvaluatorRegistry } from '../rules';
import { minCartValue } from '../rules/min-cart-value';
import { categoryRestriction } from '../rules/category-restriction';
import type { Offer } from '../schemas/offer';
import type { EvaluationContext } from '../schemas/evaluation';

function makeOffer(overrides: Partial<Offer> = {}): Offer {
  return {
    _id: 'offer_auto_1',
    merchant_id: 'merch_1',
    code: null,
    type: 'auto_offer',
    title: '10% off electronics',
    discount: { type: 'percentage', value: 10, max_discount: null },
    subsidy_model: 'merchant',
    status: 'active',
    validity: { starts_at: '2026-01-01T00:00:00.000Z', ends_at: '2026-12-31T23:59:59.000Z' },
    usage_limits: { total: null, per_customer: null },
    usage_count: 0,
    rules: [{ rule_type: 'category_restriction', config: { categories: ['electronics'], exclude: false } }],
    stacking: { stacks_with: ['coupon'], exclusive: false, priority: 0 },
    tags: [],
    created_at: '2026-07-18T09:00:00.000Z',
    updated_at: '2026-07-18T09:00:00.000Z',
    ...overrides,
  };
}

function makeContext(overrides: Partial<EvaluationContext> = {}): EvaluationContext {
  return {
    cart: {
      amount: 5000,
      items: [{ sku_id: 'SKU-1', category: 'electronics', price: 5000, qty: 1 }],
    },
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

function makeEvaluator(): AutoOfferEvaluator {
  const ruleRegistry = new RuleEvaluatorRegistry();
  ruleRegistry.register('min_cart_value', minCartValue);
  ruleRegistry.register('category_restriction', categoryRestriction);
  return new AutoOfferEvaluator(ruleRegistry);
}

describe('AutoOfferEvaluator', () => {
  it('returns eligible with percentage discount when rules pass', () => {
    const evaluator = makeEvaluator();
    const result = evaluator.evaluate(makeOffer(), makeContext());
    expect(result.eligible).toBe(true);
    expect(result.discount?.amount).toBe(500);
    expect(result.discount?.type).toBe('percentage');
  });

  it('returns ineligible when status is inactive', () => {
    const evaluator = makeEvaluator();
    const result = evaluator.evaluate(makeOffer({ status: 'inactive' }), makeContext());
    expect(result.eligible).toBe(false);
  });

  it('returns ineligible when category rule fails', () => {
    const evaluator = makeEvaluator();
    const ctx = makeContext({
      cart: { amount: 5000, items: [{ sku_id: 'SKU-1', category: 'clothing', price: 5000, qty: 1 }] },
    });
    const result = evaluator.evaluate(makeOffer(), ctx);
    expect(result.eligible).toBe(false);
    expect(result.failed_rule).toBe('category_restriction');
  });

  it('returns ineligible when validity has expired', () => {
    const evaluator = makeEvaluator();
    const offer = makeOffer({
      validity: { starts_at: '2026-01-01T00:00:00.000Z', ends_at: '2026-06-30T23:59:59.000Z' },
    });
    const result = evaluator.evaluate(offer, makeContext({ now: '2026-07-18T10:00:00.000Z' }));
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('expired');
  });

  it('evaluates correctly even when customer has no segments', () => {
    const evaluator = makeEvaluator();
    const ctx = makeContext({
      customer: { customer_id: 'anon', segments: [], total_orders: 0, per_customer_used: 0 },
    });
    const result = evaluator.evaluate(makeOffer({ rules: [] }), ctx);
    expect(result.eligible).toBe(true);
  });
});
