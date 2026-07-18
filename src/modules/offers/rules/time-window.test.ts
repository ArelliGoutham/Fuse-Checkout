import { timeWindow } from './time-window';
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

describe('timeWindow', () => {
  it('passes when current day is in allowed days and hour is in range', () => {
    // 2026-07-18 is a Saturday
    expect(timeWindow({ days: ['sat', 'sun'], start_hour: 0, end_hour: 23 }, makeContext('2026-07-18T14:00:00.000Z'))).toBe(true);
  });
  it('fails when current day is not in allowed days', () => {
    // 2026-07-20 is a Monday
    expect(timeWindow({ days: ['sat', 'sun'], start_hour: 0, end_hour: 23 }, makeContext('2026-07-20T14:00:00.000Z'))).toBe(false);
  });
  it('fails when hour is before start_hour', () => {
    expect(timeWindow({ days: ['sat'], start_hour: 10, end_hour: 20 }, makeContext('2026-07-18T09:00:00.000Z'))).toBe(false);
  });
  it('fails when hour is after end_hour', () => {
    expect(timeWindow({ days: ['sat'], start_hour: 10, end_hour: 20 }, makeContext('2026-07-18T21:00:00.000Z'))).toBe(false);
  });
  it('passes at boundary hour (start_hour)', () => {
    expect(timeWindow({ days: ['sat'], start_hour: 10, end_hour: 20 }, makeContext('2026-07-18T10:00:00.000Z'))).toBe(true);
  });
  it('passes at boundary hour (end_hour)', () => {
    expect(timeWindow({ days: ['sat'], start_hour: 10, end_hour: 20 }, makeContext('2026-07-18T20:00:00.000Z'))).toBe(true);
  });
});
