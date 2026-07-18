import { RuleEvaluatorRegistry } from './index';
import type { EvaluationContext } from '../schemas/evaluation';

const mockContext: EvaluationContext = {
  cart: { amount: 5000, items: [{ sku_id: 'SKU-1', price: 5000, qty: 1 }] },
  customer: { customer_id: 'c1', segments: [], total_orders: 0, per_customer_used: 0 },
  merchant: {
    stacking_policy: {
      max_coupons: 1,
      max_auto_offers: 1,
      max_total_discount: null,
      allow_cross_type: true,
      exclusive_tags: [],
    },
  },
  usage: { per_customer_used: 0, total_used: 0 },
  now: '2026-07-18T10:00:00.000Z',
};

describe('RuleEvaluatorRegistry', () => {
  it('registers and calls a rule evaluator', () => {
    const registry = new RuleEvaluatorRegistry();
    registry.register('min_cart_value', (config, ctx) => {
      return ctx.cart.amount >= (config as { min_amount: number }).min_amount;
    });
    const rule = { rule_type: 'min_cart_value' as const, config: { min_amount: 500 } };
    expect(registry.evaluate(rule, mockContext)).toBe(true);
  });

  it('returns false when rule fails', () => {
    const registry = new RuleEvaluatorRegistry();
    registry.register('min_cart_value', (config, ctx) => {
      return ctx.cart.amount >= (config as { min_amount: number }).min_amount;
    });
    const rule = { rule_type: 'min_cart_value' as const, config: { min_amount: 10000 } };
    expect(registry.evaluate(rule, mockContext)).toBe(false);
  });

  it('throws when evaluating unregistered rule type', () => {
    const registry = new RuleEvaluatorRegistry();
    const rule = { rule_type: 'unknown' as never, config: {} };
    expect(() => registry.evaluate(rule, mockContext)).toThrow(/unknown/);
  });

  it('checks if a rule type is registered', () => {
    const registry = new RuleEvaluatorRegistry();
    registry.register('min_cart_value', () => true);
    expect(registry.has('min_cart_value')).toBe(true);
    expect(registry.has('unknown')).toBe(false);
  });
});
