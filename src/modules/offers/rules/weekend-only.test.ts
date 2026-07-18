import { weekendOnly } from './weekend-only';
import type { EvaluationContext } from '../schemas/evaluation';

function makeContext(isoTime: string): EvaluationContext {
  return {
    cart: { amount: 1000, items: [] },
    customer: { customer_id: 'c1', segments: [], total_orders: 0, per_customer_used: 0 },
    merchant: { stacking_policy: { max_coupons: 1, max_auto_offers: 1, max_total_discount: null, allow_cross_type: true, exclusive_tags: [] } },
    usage: { per_customer_used: 0, total_used: 0 },
    now: isoTime,
  };
}

describe('weekendOnly', () => {
  it('passes on Saturday', () => {
    expect(weekendOnly({}, makeContext('2026-07-18T12:00:00.000Z'))).toBe(true);
  });
  it('passes on Sunday', () => {
    expect(weekendOnly({}, makeContext('2026-07-19T12:00:00.000Z'))).toBe(true);
  });
  it('fails on Monday', () => {
    expect(weekendOnly({}, makeContext('2026-07-20T12:00:00.000Z'))).toBe(false);
  });
  it('fails on Friday', () => {
    expect(weekendOnly({}, makeContext('2026-07-17T12:00:00.000Z'))).toBe(false);
  });
});
