import { categoryRestriction } from './category-restriction';
import type { EvaluationContext } from '../schemas/evaluation';

function makeContext(items: { sku_id: string; category?: string; price: number; qty: number }[]): EvaluationContext {
  return {
    cart: { amount: items.reduce((sum, i) => sum + i.price * i.qty, 0), items: items as never },
    customer: { customer_id: 'c1', segments: [], total_orders: 0, per_customer_used: 0 },
    merchant: { stacking_policy: { max_coupons: 1, max_auto_offers: 1, max_total_discount: null, allow_cross_type: true, exclusive_tags: [] } },
    usage: { per_customer_used: 0, total_used: 0 },
    now: '2026-07-18T10:00:00.000Z',
  };
}

describe('categoryRestriction', () => {
  it('passes (inclusive) when cart contains an item in target category', () => {
    const ctx = makeContext([{ sku_id: 'SKU-1', category: 'electronics', price: 5000, qty: 1 }]);
    expect(categoryRestriction({ categories: ['electronics'], exclude: false }, ctx)).toBe(true);
  });
  it('fails (inclusive) when cart has no item in target category', () => {
    const ctx = makeContext([{ sku_id: 'SKU-1', category: 'clothing', price: 1000, qty: 1 }]);
    expect(categoryRestriction({ categories: ['electronics'], exclude: false }, ctx)).toBe(false);
  });
  it('passes (exclusive) when cart does NOT contain target category', () => {
    const ctx = makeContext([{ sku_id: 'SKU-1', category: 'clothing', price: 1000, qty: 1 }]);
    expect(categoryRestriction({ categories: ['electronics'], exclude: true }, ctx)).toBe(true);
  });
  it('fails (exclusive) when cart contains target category', () => {
    const ctx = makeContext([{ sku_id: 'SKU-1', category: 'electronics', price: 5000, qty: 1 }]);
    expect(categoryRestriction({ categories: ['electronics'], exclude: true }, ctx)).toBe(false);
  });
  it('passes when item has no category and rule is inclusive with other categories', () => {
    const ctx = makeContext([{ sku_id: 'SKU-1', price: 1000, qty: 1 }]);
    expect(categoryRestriction({ categories: ['electronics'], exclude: false }, ctx)).toBe(false);
  });
});
