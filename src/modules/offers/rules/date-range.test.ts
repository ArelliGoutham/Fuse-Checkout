import { dateRange } from './date-range';
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

describe('dateRange', () => {
  it('passes when current date is within range', () => {
    expect(dateRange({ start_date: '2026-07-01', end_date: '2026-07-31' }, makeContext('2026-07-18T12:00:00.000Z'))).toBe(true);
  });
  it('passes at start boundary', () => {
    expect(dateRange({ start_date: '2026-07-01', end_date: '2026-07-31' }, makeContext('2026-07-01T00:00:00.000Z'))).toBe(true);
  });
  it('passes at end boundary', () => {
    expect(dateRange({ start_date: '2026-07-01', end_date: '2026-07-31' }, makeContext('2026-07-31T23:59:59.000Z'))).toBe(true);
  });
  it('fails before start date', () => {
    expect(dateRange({ start_date: '2026-07-01', end_date: '2026-07-31' }, makeContext('2026-06-30T23:59:59.000Z'))).toBe(false);
  });
  it('fails after end date', () => {
    expect(dateRange({ start_date: '2026-07-01', end_date: '2026-07-31' }, makeContext('2026-08-01T00:00:00.000Z'))).toBe(false);
  });
});
