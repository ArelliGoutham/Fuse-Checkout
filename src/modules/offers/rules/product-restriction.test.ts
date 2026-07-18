import { productRestriction } from './product-restriction';
import type { EvaluationContext } from '../schemas/evaluation';

function makeContext(skus: string[]): EvaluationContext {
  return {
    cart: { amount: 1000 * skus.length, items: skus.map((s) => ({ sku_id: s, price: 1000, qty: 1 })) as never },
    customer: { customer_id: 'c1', segments: [], total_orders: 0, per_customer_used: 0 },
    merchant: { stacking_policy: { max_coupons: 1, max_auto_offers: 1, max_total_discount: null, allow_cross_type: true, exclusive_tags: [] } },
    usage: { per_customer_used: 0, total_used: 0 },
    now: '2026-07-18T10:00:00.000Z',
  };
}

describe('productRestriction', () => {
  it('passes (inclusive) when cart contains target SKU', () => {
    expect(productRestriction({ skus: ['SKU-1'], exclude: false }, makeContext(['SKU-1', 'SKU-2']))).toBe(true);
  });
  it('fails (inclusive) when cart does not contain target SKU', () => {
    expect(productRestriction({ skus: ['SKU-9'], exclude: false }, makeContext(['SKU-1']))).toBe(false);
  });
  it('passes (exclusive) when cart does NOT contain target SKU', () => {
    expect(productRestriction({ skus: ['SKU-9'], exclude: true }, makeContext(['SKU-1']))).toBe(true);
  });
  it('fails (exclusive) when cart contains target SKU', () => {
    expect(productRestriction({ skus: ['SKU-1'], exclude: true }, makeContext(['SKU-1']))).toBe(false);
  });
});
