import { EvaluationContextSchema, EvaluationResultSchema } from './evaluation';

describe('EvaluationContextSchema', () => {
  it('parses a full evaluation context', () => {
    const ctx = {
      cart: { amount: 5000, items: [{ sku_id: 'SKU-1', price: 5000, qty: 1 }] },
      customer: { customer_id: 'cust_1', segments: ['new'], total_orders: 0, per_customer_used: 0 },
      merchant: {
        stacking_policy: {
          max_coupons: 1, max_auto_offers: 1, max_total_discount: null,
          allow_cross_type: true, exclusive_tags: [],
        },
      },
      usage: { per_customer_used: 0, total_used: 0 },
      now: '2026-07-18T10:00:00.000Z',
    };
    expect(EvaluationContextSchema.parse(ctx)).toEqual(ctx);
  });

  it('parses context with empty cart', () => {
    const ctx = {
      cart: { amount: 0, items: [] },
      customer: { customer_id: 'cust_1', segments: [], total_orders: 0, per_customer_used: 0 },
      merchant: {
        stacking_policy: {
          max_coupons: 1, max_auto_offers: 1, max_total_discount: null,
          allow_cross_type: true, exclusive_tags: [],
        },
      },
      usage: { per_customer_used: 0, total_used: 0 },
      now: '2026-07-18T10:00:00.000Z',
    };
    expect(EvaluationContextSchema.parse(ctx)).toEqual(ctx);
  });
});

describe('EvaluationResultSchema', () => {
  it('parses an eligible result with discount', () => {
    const result = {
      eligible: true,
      matched_rules: ['min_cart_value', 'customer_segment'],
      failed_rule: null,
      reason: null,
      discount: { type: 'flat', value: 50, max_discount: null, amount: 50 },
    };
    expect(EvaluationResultSchema.parse(result)).toEqual(result);
  });

  it('parses an ineligible result with reason', () => {
    const result = {
      eligible: false,
      matched_rules: [],
      failed_rule: 'min_cart_value',
      reason: 'Cart amount ₹300 is below minimum ₹500',
      discount: null,
    };
    expect(EvaluationResultSchema.parse(result)).toEqual(result);
  });
});
