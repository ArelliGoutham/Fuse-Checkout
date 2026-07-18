import { totalUsageLimit } from './total-usage-limit';
import type { EvaluationContext } from '../schemas/evaluation';

function makeContext(totalUsed: number): EvaluationContext {
  return {
    cart: { amount: 1000, items: [] },
    customer: { customer_id: 'c1', segments: [], total_orders: 0, per_customer_used: 0 },
    merchant: { stacking_policy: { max_coupons: 1, max_auto_offers: 1, max_total_discount: null, allow_cross_type: true, exclusive_tags: [] } },
    usage: { per_customer_used: 0, total_used: totalUsed },
    now: '2026-07-18T10:00:00.000Z',
  };
}

describe('totalUsageLimit', () => {
  it('passes when total usage is below limit', () => {
    expect(totalUsageLimit({ limit: 1000 }, makeContext(999))).toBe(true);
  });
  it('fails when total usage equals limit', () => {
    expect(totalUsageLimit({ limit: 1000 }, makeContext(1000))).toBe(false);
  });
  it('passes when total usage is zero', () => {
    expect(totalUsageLimit({ limit: 100 }, makeContext(0))).toBe(true);
  });
});
