import { customerSegment } from './customer-segment';
import type { EvaluationContext } from '../schemas/evaluation';

function makeContext(segments: string[]): EvaluationContext {
  return {
    cart: { amount: 1000, items: [] },
    customer: { customer_id: 'c1', segments, total_orders: 0, per_customer_used: 0 },
    merchant: { stacking_policy: { max_coupons: 1, max_auto_offers: 1, max_total_discount: null, allow_cross_type: true, exclusive_tags: [] } },
    usage: { per_customer_used: 0, total_used: 0 },
    now: '2026-07-18T10:00:00.000Z',
  };
}

describe('customerSegment', () => {
  it('passes when customer has one of the required segments', () => {
    expect(customerSegment({ segments: ['new', 'vip'] }, makeContext(['new']))).toBe(true);
  });
  it('passes when customer has all required segments', () => {
    expect(customerSegment({ segments: ['new', 'vip'] }, makeContext(['new', 'vip']))).toBe(true);
  });
  it('fails when customer has none of the required segments', () => {
    expect(customerSegment({ segments: ['vip'] }, makeContext(['new']))).toBe(false);
  });
  it('fails when customer has empty segments but rule requires one', () => {
    expect(customerSegment({ segments: ['new'] }, makeContext([]))).toBe(false);
  });
  it('passes when rule requires empty segments', () => {
    expect(customerSegment({ segments: [] }, makeContext(['new']))).toBe(true);
  });
});
