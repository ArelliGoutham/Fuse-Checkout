import { maxCartValue } from './max-cart-value';
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

describe('maxCartValue', () => {
  it('passes when cart equals max_amount (boundary)', () => {
    expect(maxCartValue({ max_amount: 50000 }, makeContext(50000))).toBe(true);
  });
  it('passes when cart is below max_amount', () => {
    expect(maxCartValue({ max_amount: 50000 }, makeContext(49999))).toBe(true);
  });
  it('fails when cart exceeds max_amount', () => {
    expect(maxCartValue({ max_amount: 50000 }, makeContext(50001))).toBe(false);
  });
});
