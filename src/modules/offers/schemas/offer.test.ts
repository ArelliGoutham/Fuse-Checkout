import { OfferSchema, RuleSchema } from './offer';

describe('RuleSchema', () => {
  it('parses a min_cart_value rule', () => {
    const rule = { rule_type: 'min_cart_value', config: { min_amount: 500 } };
    expect(RuleSchema.parse(rule)).toEqual(rule);
  });

  it('parses a customer_segment rule', () => {
    const rule = { rule_type: 'customer_segment', config: { segments: ['new', 'vip'] } };
    expect(RuleSchema.parse(rule)).toEqual(rule);
  });

  it('parses a time_window rule', () => {
    const rule = { rule_type: 'time_window', config: { days: ['sat', 'sun'], start_hour: 0, end_hour: 23 } };
    expect(RuleSchema.parse(rule)).toEqual(rule);
  });

  it('parses a product_combo rule', () => {
    const rule = { rule_type: 'product_combo', config: { skus: ['SKU-1', 'SKU-2'] } };
    expect(RuleSchema.parse(rule)).toEqual(rule);
  });

  it('parses a date_range rule', () => {
    const rule = { rule_type: 'date_range', config: { start_date: '2026-07-01', end_date: '2026-07-31' } };
    expect(RuleSchema.parse(rule)).toEqual(rule);
  });
});

describe('OfferSchema', () => {
  const validOffer = {
    _id: 'offer_123',
    merchant_id: 'merch_abc',
    code: 'FLAT50',
    type: 'coupon',
    title: 'Flat ₹50 off',
    description: 'Get ₹50 off on orders above ₹500',
    discount: { type: 'flat', value: 50, max_discount: null },
    subsidy_model: 'merchant',
    status: 'active',
    validity: { starts_at: '2026-07-01T00:00:00.000Z', ends_at: '2026-12-31T23:59:59.000Z' },
    usage_limits: { total: 1000, per_customer: 2 },
    usage_count: 0,
    rules: [{ rule_type: 'min_cart_value', config: { min_amount: 500 } }],
    stacking: { stacks_with: null, exclusive: false, priority: 0 },
    tags: [],
    created_at: '2026-07-18T09:00:00.000Z',
    updated_at: '2026-07-18T09:00:00.000Z',
  };

  it('parses a valid coupon offer', () => {
    expect(OfferSchema.parse(validOffer)).toEqual(validOffer);
  });

  it('parses an auto-offer with null code', () => {
    const autoOffer = { ...validOffer, _id: 'offer_456', code: null, type: 'auto_offer' };
    expect(OfferSchema.parse(autoOffer)).toEqual(autoOffer);
  });

  it('rejects unknown offer type', () => {
    expect(() => OfferSchema.parse({ ...validOffer, type: 'unknown_type' })).toThrow();
  });

  it('rejects unknown rule_type', () => {
    expect(() => OfferSchema.parse({
      ...validOffer, rules: [{ rule_type: 'unknown_rule', config: {} }],
    })).toThrow();
  });
});
