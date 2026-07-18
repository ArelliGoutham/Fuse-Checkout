import { minCartValue } from './min-cart-value';
import type { EvaluationContext } from '../schemas/evaluation';

function makeContext(cartAmount: number): EvaluationContext {
  return {
    cart: { amount: cartAmount, items: [] },
    customer: { customer_id: 'c1', segments: [], total_orders: 0, per_customer_used: 0 },
    merchant: { stacking_policy: { max_coupons: 1, max_auto_offers: 1, max_total_discount: null, allow_cross_type: true, exclusive_tags: [] } },
    usage: { per_customer_used: 0, total_used: 0 },
    now: '2026-07-18T10:00:00.000Z',
  };
}

describe('minCartValue', () => {
  it('passes when cart equals min_amount (boundary)', () => {
    expect(minCartValue({ min_amount: 500 }, makeContext(500))).toBe(true);
  });
  it('passes when cart exceeds min_amount', () => {
    expect(minCartValue({ min_amount: 500 }, makeContext(501))).toBe(true);
  });
  it('fails when cart is below min_amount', () => {
    expect(minCartValue({ min_amount: 500 }, makeContext(499))).toBe(false);
  });
  it('passes when min_amount is 0', () => {
    expect(minCartValue({ min_amount: 0 }, makeContext(0))).toBe(true);
  });
});
