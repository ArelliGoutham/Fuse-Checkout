import { brandRestriction } from './brand-restriction';
import type { EvaluationContext } from '../schemas/evaluation';

function makeContext(items: { sku_id: string; brand?: string; price: number; qty: number }[]): EvaluationContext {
  return {
    cart: { amount: items.reduce((s, i) => s + i.price * i.qty, 0), items: items as never },
    customer: { customer_id: 'c1', segments: [], total_orders: 0, per_customer_used: 0 },
    merchant: { stacking_policy: { max_coupons: 1, max_auto_offers: 1, max_total_discount: null, allow_cross_type: true, exclusive_tags: [] } },
    usage: { per_customer_used: 0, total_used: 0 },
    now: '2026-07-18T10:00:00.000Z',
  };
}

describe('brandRestriction', () => {
  it('passes (inclusive) when cart has Apple brand item', () => {
    const ctx = makeContext([{ sku_id: 'SKU-1', brand: 'Apple', price: 50000, qty: 1 }]);
    expect(brandRestriction({ brands: ['Apple'], exclude: false }, ctx)).toBe(true);
  });
  it('fails (inclusive) when cart has no Apple item', () => {
    const ctx = makeContext([{ sku_id: 'SKU-1', brand: 'Samsung', price: 30000, qty: 1 }]);
    expect(brandRestriction({ brands: ['Apple'], exclude: false }, ctx)).toBe(false);
  });
  it('passes (exclusive) when cart has no Apple item', () => {
    const ctx = makeContext([{ sku_id: 'SKU-1', brand: 'Samsung', price: 30000, qty: 1 }]);
    expect(brandRestriction({ brands: ['Apple'], exclude: true }, ctx)).toBe(true);
  });
  it('fails (exclusive) when cart has Apple item', () => {
    const ctx = makeContext([{ sku_id: 'SKU-1', brand: 'Apple', price: 50000, qty: 1 }]);
    expect(brandRestriction({ brands: ['Apple'], exclude: true }, ctx)).toBe(false);
  });
});
