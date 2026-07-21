import {
  validateCampaignEligibility,
  type CampaignValidationInput,
} from './emi-campaign-engine';
import type { EMICampaign } from '../schemas/emi-campaign';
import type { IINRange } from '../schemas/iin-range';

const baseCampaign: EMICampaign = {
  _id: 'camp_test',
  code: 'EMI_HDFC_50',
  title: 'HDFC No-Cost EMI',
  scope: 'merchant',
  merchant_id: 'm1',
  brand: null,
  bank: 'HDFC',
  iin_prefixes: ['459130', '459131'],
  card_tiers: ['platinum', 'signature'],
  emi_type: 'no_cost',
  products: null,
  max_total: 100,
  max_per_merchant: null,
  max_per_card: 2,
  subsidy_amount: null,
  requires_imei: false,
  starts_at: '2026-07-01T00:00:00.000Z',
  ends_at: '2026-12-31T23:59:59.000Z',
  status: 'active',
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-01T00:00:00.000Z',
};

const baseCardInfo: IINRange = {
  prefix: '459130',
  bank_code: 'HDFC',
  bank_name: 'HDFC Bank',
  card_type: 'credit',
  card_tier: 'platinum',
  card_network: 'visa',
  status: 'active',
};

const baseInput: CampaignValidationInput = {
  campaign: baseCampaign,
  cardInfo: baseCardInfo,
  cartAmount: 5000,
  productSkus: ['sku1'],
  merchantId: 'm1',
  redemptionCounts: {
    total_redemptions: 0,
    merchant_redemptions: 0,
    card_redemptions: 0,
  },
  now: new Date('2026-07-21T00:00:00.000Z'),
};

function callWith(overrides: Partial<CampaignValidationInput> = {}): CampaignValidationInput {
  return {
    ...baseInput,
    ...overrides,
    campaign: overrides.campaign
      ? { ...baseInput.campaign, ...overrides.campaign }
      : baseInput.campaign,
    cardInfo: overrides.cardInfo
      ? { ...baseInput.cardInfo, ...overrides.cardInfo }
      : baseInput.cardInfo,
    redemptionCounts: overrides.redemptionCounts
      ? { ...baseInput.redemptionCounts, ...overrides.redemptionCounts }
      : baseInput.redemptionCounts,
  };
}

describe('validateCampaignEligibility', () => {
  it('1. returns eligible when all checks pass', () => {
    const result = validateCampaignEligibility(callWith());
    expect(result.eligible).toBe(true);
    expect(result.reason).toBeNull();
  });

  it('2. returns ineligible when IIN prefix does not match (reason contains "IIN")', () => {
    const result = validateCampaignEligibility(
      callWith({ cardInfo: { ...baseCardInfo, prefix: '999999' } }),
    );
    expect(result.eligible).toBe(false);
    expect(result.reason?.toLowerCase()).toContain('iin');
  });

  it('3. returns ineligible when card tier does not match (reason contains "tier")', () => {
    const result = validateCampaignEligibility(
      callWith({ cardInfo: { ...baseCardInfo, card_tier: 'gold' } }),
    );
    expect(result.eligible).toBe(false);
    expect(result.reason?.toLowerCase()).toContain('tier');
  });

  it('4. returns ineligible when product not in campaign list (reason contains "product")', () => {
    const result = validateCampaignEligibility(
      callWith({
        campaign: { ...baseCampaign, products: ['sku2', 'sku3'] },
        productSkus: ['sku1'],
      }),
    );
    expect(result.eligible).toBe(false);
    expect(result.reason?.toLowerCase()).toContain('product');
  });

  it('5. returns eligible when products is null (all products allowed)', () => {
    const result = validateCampaignEligibility(
      callWith({ productSkus: ['anything-not-in-any-list'] }),
    );
    expect(result.eligible).toBe(true);
    expect(result.reason).toBeNull();
  });

  it('6. returns ineligible when campaign total exceeded (reason contains "campaign cap")', () => {
    const result = validateCampaignEligibility(
      callWith({
        redemptionCounts: {
          total_redemptions: 100,
          merchant_redemptions: 0,
          card_redemptions: 0,
        },
      }),
    );
    expect(result.eligible).toBe(false);
    expect(result.reason?.toLowerCase()).toContain('campaign cap');
  });

  it('7. returns ineligible when per-card velocity exceeded (reason contains "per-card")', () => {
    const result = validateCampaignEligibility(
      callWith({
        redemptionCounts: {
          total_redemptions: 0,
          merchant_redemptions: 0,
          card_redemptions: 2,
        },
      }),
    );
    expect(result.eligible).toBe(false);
    expect(result.reason?.toLowerCase()).toContain('per-card');
  });

  it('8. returns ineligible when per-merchant cap exceeded for brand campaign (reason contains "per-merchant")', () => {
    const result = validateCampaignEligibility(
      callWith({
        campaign: {
          ...baseCampaign,
          scope: 'brand',
          merchant_id: null,
          brand: 'HDFC',
          max_per_merchant: 5,
        },
        merchantId: 'm_brand_test',
        redemptionCounts: {
          total_redemptions: 0,
          merchant_redemptions: 5,
          card_redemptions: 0,
        },
      }),
    );
    expect(result.eligible).toBe(false);
    expect(result.reason?.toLowerCase()).toContain('per-merchant');
  });

  it('9. returns ineligible when date is outside campaign window (reason contains "expired")', () => {
    const result = validateCampaignEligibility(
      callWith({ now: new Date('2027-01-01T00:00:00.000Z') }),
    );
    expect(result.eligible).toBe(false);
    expect(result.reason?.toLowerCase()).toContain('expired');
  });

  it('10. returns ineligible when campaign status is inactive (reason contains "inactive")', () => {
    const result = validateCampaignEligibility(
      callWith({ campaign: { ...baseCampaign, status: 'inactive' } }),
    );
    expect(result.eligible).toBe(false);
    expect(result.reason?.toLowerCase()).toContain('inactive');
  });

  it('11. returns ineligible for merchant campaign when merchant mismatch (reason contains "merchant")', () => {
    const result = validateCampaignEligibility(
      callWith({ campaign: { ...baseCampaign, merchant_id: 'm2' } }),
    );
    expect(result.eligible).toBe(false);
    expect(result.reason?.toLowerCase()).toContain('merchant');
  });
});
