import { firstTimeBuyer } from './first-time-buyer';
import type { EvaluationContext } from '../schemas/evaluation';

function makeContext(totalOrders: number): EvaluationContext {
  return {
    cart: { amount: 1000, items: [] },
    customer: { customer_id: 'c1', segments: [], total_orders: totalOrders, per_customer_used: 0 },
    merchant: { stacking_policy: { max_coupons: 1, max_auto_offers: 1, max_total_discount: null, allow_cross_type: true, exclusive_tags: [] } },
    usage: { per_customer_used: 0, total_used: 0 },
    now: '2026-07-18T10:00:00.000Z',
  };
}

describe('firstTimeBuyer', () => {
  it('passes when customer has zero orders', () => {
    expect(firstTimeBuyer({}, makeContext(0))).toBe(true);
  });
  it('fails when customer has one order', () => {
    expect(firstTimeBuyer({}, makeContext(1))).toBe(false);
  });
  it('fails when customer has many orders', () => {
    expect(firstTimeBuyer({}, makeContext(50))).toBe(false);
  });
});
