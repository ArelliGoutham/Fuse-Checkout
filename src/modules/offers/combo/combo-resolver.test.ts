import { ComboResolver } from './combo-resolver';
import type { Offer } from '../schemas/offer';
import type { EvaluationResult, StackingPolicy } from '../schemas/evaluation';

function makeOffer(
  id: string,
  type: 'coupon' | 'auto_offer',
  discountAmount: number,
  overrides: Partial<Offer> = {},
): { offer: Offer; result: EvaluationResult } {
  const offer: Offer = {
    _id: id,
    merchant_id: 'merch_1',
    code: type === 'coupon' ? `CODE${id}` : null,
    type,
    title: `Offer ${id}`,
    discount: { type: 'flat', value: discountAmount, max_discount: null },
    subsidy_model: 'merchant',
    status: 'active',
    validity: { starts_at: '2026-01-01T00:00:00.000Z', ends_at: '2026-12-31T23:59:59.000Z' },
    usage_limits: { total: null, per_customer: null },
    usage_count: 0,
    rules: [],
    stacking: { stacks_with: null, exclusive: false, priority: 0 },
    tags: [],
    created_at: '2026-07-18T09:00:00.000Z',
    updated_at: '2026-07-18T09:00:00.000Z',
    ...overrides,
  };
  const result: EvaluationResult = {
    eligible: true,
    matched_rules: [],
    failed_rule: null,
    reason: null,
    discount: { type: 'flat', value: discountAmount, max_discount: null, amount: discountAmount },
  };
  return { offer, result };
}

const defaultPolicy: StackingPolicy = {
  max_coupons: 1,
  max_auto_offers: 1,
  max_total_discount: null,
  allow_cross_type: true,
  exclusive_tags: [],
};

describe('ComboResolver', () => {
  it('applies a single offer with no conflicts', () => {
    const resolver = new ComboResolver();
    const { offer, result } = makeOffer('1', 'coupon', 50);
    const combo = resolver.resolve([{ offer, result }], defaultPolicy, 5000);
    expect(combo.applied).toHaveLength(1);
    expect(combo.applied[0].offer_id).toBe('1');
    expect(combo.applied[0].discount_amount).toBe(50);
    expect(combo.rejected).toHaveLength(0);
    expect(combo.total_discount).toBe(50);
    expect(combo.final_amount).toBe(4950);
  });

  it('stacks a coupon + auto_offer when allow_cross_type is true', () => {
    const resolver = new ComboResolver();
    const coupon = makeOffer('1', 'coupon', 50);
    const auto = makeOffer('2', 'auto_offer', 500);
    const combo = resolver.resolve([coupon, auto], defaultPolicy, 5000);
    expect(combo.applied).toHaveLength(2);
    expect(combo.total_discount).toBe(550);
    expect(combo.final_amount).toBe(4450);
  });

  it('rejects cross-type stacking when allow_cross_type is false', () => {
    const resolver = new ComboResolver();
    const coupon = makeOffer('1', 'coupon', 50);
    const auto = makeOffer('2', 'auto_offer', 500);
    const policy: StackingPolicy = { ...defaultPolicy, allow_cross_type: false };
    const combo = resolver.resolve([coupon, auto], policy, 5000);
    expect(combo.applied).toHaveLength(1);
    expect(combo.applied[0].offer_id).toBe('2'); // higher discount wins
    expect(combo.rejected).toHaveLength(1);
    expect(combo.rejected[0].offer_id).toBe('1');
    expect(combo.rejected[0].reason).toContain('cross-type');
  });

  it('rejects second coupon when max_coupons is 1', () => {
    const resolver = new ComboResolver();
    const coupon1 = makeOffer('1', 'coupon', 50);
    const coupon2 = makeOffer('2', 'coupon', 100);
    const combo = resolver.resolve([coupon1, coupon2], defaultPolicy, 5000);
    expect(combo.applied).toHaveLength(1);
    expect(combo.applied[0].offer_id).toBe('2'); // higher discount wins
    expect(combo.rejected).toHaveLength(1);
    expect(combo.rejected[0].reason).toContain('max_coupons');
  });

  it('enforces exclusive flag — only exclusive offer is applied', () => {
    const resolver = new ComboResolver();
    const exclusive = makeOffer('1', 'auto_offer', 1000, {
      stacking: { stacks_with: null, exclusive: true, priority: 10 },
    });
    const normal = makeOffer('2', 'coupon', 50);
    const combo = resolver.resolve([exclusive, normal], defaultPolicy, 5000);
    expect(combo.applied).toHaveLength(1);
    expect(combo.applied[0].offer_id).toBe('1');
    expect(combo.rejected).toHaveLength(1);
    expect(combo.rejected[0].reason).toContain('exclusive');
  });

  it('enforces max_total_discount cap', () => {
    const resolver = new ComboResolver();
    const coupon = makeOffer('1', 'coupon', 500);
    const auto = makeOffer('2', 'auto_offer', 600);
    const policy: StackingPolicy = { ...defaultPolicy, max_total_discount: 800 };
    const combo = resolver.resolve([coupon, auto], policy, 5000);
    expect(combo.total_discount).toBe(800);
    expect(combo.final_amount).toBe(4200);
    expect(combo.applied).toHaveLength(2); // both still applied, but total capped
  });

  it('rejects offers with exclusive_tags when another offer is present', () => {
    const resolver = new ComboResolver();
    const flash = makeOffer('1', 'auto_offer', 1000, { tags: ['flash'] });
    const normal = makeOffer('2', 'coupon', 50);
    const policy: StackingPolicy = { ...defaultPolicy, exclusive_tags: ['flash'] };
    const combo = resolver.resolve([flash, normal], policy, 5000);
    expect(combo.applied).toHaveLength(1);
    expect(combo.applied[0].offer_id).toBe('1'); // flash has higher discount
    expect(combo.rejected).toHaveLength(1);
    expect(combo.rejected[0].reason).toContain('exclusive tag');
  });

  it('respects per-offer stacks_with restriction', () => {
    const resolver = new ComboResolver();
    const coupon = makeOffer('1', 'coupon', 50);
    const auto = makeOffer('2', 'auto_offer', 500, {
      stacking: { stacks_with: ['auto_offer'], exclusive: false, priority: 0 },
    });
    // auto_offer only stacks with auto_offer, not coupon
    const combo = resolver.resolve([coupon, auto], defaultPolicy, 5000);
    expect(combo.applied).toHaveLength(1);
    expect(combo.applied[0].offer_id).toBe('2'); // higher discount
    expect(combo.rejected).toHaveLength(1);
    expect(combo.rejected[0].reason).toContain('stacks_with');
  });

  it('returns empty applied when no offers are eligible', () => {
    const resolver = new ComboResolver();
    const combo = resolver.resolve([], defaultPolicy, 5000);
    expect(combo.applied).toHaveLength(0);
    expect(combo.rejected).toHaveLength(0);
    expect(combo.total_discount).toBe(0);
    expect(combo.final_amount).toBe(5000);
  });
});
