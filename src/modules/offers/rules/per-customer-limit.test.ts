import { perCustomerLimit } from './per-customer-limit';
import type { EvaluationContext } from '../schemas/evaluation';

function makeContext(perCustomerUsed: number): EvaluationContext {
  return {
    cart: { amount: 1000, items: [] },
    customer: { customer_id: 'c1', segments: [], total_orders: 0, per_customer_used: perCustomerUsed },
    merchant: { stacking_policy: { max_coupons: 1, max_auto_offers: 1, max_total_discount: null, allow_cross_type: true, exclusive_tags: [] } },
    usage: { per_customer_used: perCustomerUsed, total_used: 0 },
    now: '2026-07-18T10:00:00.000Z',
  };
}

describe('perCustomerLimit', () => {
  it('passes when usage is below limit', () => {
    expect(perCustomerLimit({ limit: 2 }, makeContext(1))).toBe(true);
  });
  it('fails when usage equals limit', () => {
    expect(perCustomerLimit({ limit: 2 }, makeContext(2))).toBe(false);
  });
  it('fails when usage exceeds limit', () => {
    expect(perCustomerLimit({ limit: 2 }, makeContext(3))).toBe(false);
  });
  it('passes when usage is 0 and limit is 1', () => {
    expect(perCustomerLimit({ limit: 1 }, makeContext(0))).toBe(true);
  });
});
