import { productCombo } from './product-combo';
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

describe('productCombo', () => {
  it('passes when all required SKUs are in cart', () => {
    expect(productCombo({ skus: ['SKU-1', 'SKU-2'] }, makeContext(['SKU-1', 'SKU-2', 'SKU-3']))).toBe(true);
  });
  it('fails when one required SKU is missing', () => {
    expect(productCombo({ skus: ['SKU-1', 'SKU-2'] }, makeContext(['SKU-1', 'SKU-3']))).toBe(false);
  });
  it('fails when no required SKUs are in cart', () => {
    expect(productCombo({ skus: ['SKU-1', 'SKU-2'] }, makeContext(['SKU-3']))).toBe(false);
  });
  it('passes with single SKU combo when present', () => {
    expect(productCombo({ skus: ['SKU-1'] }, makeContext(['SKU-1']))).toBe(true);
  });
});
