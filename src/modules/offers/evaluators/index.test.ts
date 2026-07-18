import { OfferEvaluatorRegistry } from './index';
import type { OfferEvaluator } from './types';
import type { Offer } from '../schemas/offer';
import type { EvaluationContext, EvaluationResult } from '../schemas/evaluation';

const mockOffer: Offer = {
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
};

const mockContext: EvaluationContext = {
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
};

const mockEvaluator: OfferEvaluator = {
  evaluate: (_offer, _context): EvaluationResult => ({
    eligible: true,
    matched_rules: [],
    failed_rule: null,
    reason: null,
    discount: { type: 'flat', value: 50, max_discount: null, amount: 50 },
  }),
};

describe('OfferEvaluatorRegistry', () => {
  it('registers and calls an evaluator by offer type', () => {
    const registry = new OfferEvaluatorRegistry();
    registry.register('coupon', mockEvaluator);
    const result = registry.evaluate(mockOffer, mockContext);
    expect(result.eligible).toBe(true);
    expect(result.discount?.amount).toBe(50);
  });

  it('throws when evaluating unregistered offer type', () => {
    const registry = new OfferEvaluatorRegistry();
    expect(() => registry.evaluate(mockOffer, mockContext)).toThrow(/coupon/);
  });

  it('checks if an offer type is registered', () => {
    const registry = new OfferEvaluatorRegistry();
    registry.register('coupon', mockEvaluator);
    expect(registry.has('coupon')).toBe(true);
    expect(registry.has('auto_offer')).toBe(false);
  });
});
