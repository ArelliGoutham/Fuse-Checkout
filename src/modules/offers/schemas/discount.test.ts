import { DiscountSchema, computeDiscount } from './discount';

describe('DiscountSchema', () => {
  it('parses a flat discount', () => {
    const d = { type: 'flat', value: 50, max_discount: null };
    expect(DiscountSchema.parse(d)).toEqual(d);
  });

  it('parses a percentage discount with cap', () => {
    const d = { type: 'percentage', value: 10, max_discount: 500 };
    expect(DiscountSchema.parse(d)).toEqual(d);
  });

  it('parses a percentage discount without cap', () => {
    const d = { type: 'percentage', value: 10, max_discount: null };
    expect(DiscountSchema.parse(d)).toEqual(d);
  });

  it('rejects negative discount value', () => {
    expect(() => DiscountSchema.parse({ type: 'flat', value: -50, max_discount: null })).toThrow();
  });

  it('rejects percentage over 100', () => {
    expect(() => DiscountSchema.parse({ type: 'percentage', value: 150, max_discount: null })).toThrow();
  });
});

describe('computeDiscount', () => {
  it('returns flat value directly when below cart amount', () => {
    const d = { type: 'flat' as const, value: 50, max_discount: null };
    expect(computeDiscount(d, 5000)).toBe(50);
  });

  it('returns cart amount when flat exceeds cart', () => {
    const d = { type: 'flat' as const, value: 5000, max_discount: null };
    expect(computeDiscount(d, 100)).toBe(100);
  });

  it('returns percentage of cart', () => {
    const d = { type: 'percentage' as const, value: 10, max_discount: null };
    expect(computeDiscount(d, 5000)).toBe(500);
  });

  it('caps percentage discount at max_discount', () => {
    const d = { type: 'percentage' as const, value: 10, max_discount: 300 };
    expect(computeDiscount(d, 5000)).toBe(300);
  });

  it('does not cap when percentage result is below max_discount', () => {
    const d = { type: 'percentage' as const, value: 10, max_discount: 300 };
    expect(computeDiscount(d, 2000)).toBe(200);
  });
});
