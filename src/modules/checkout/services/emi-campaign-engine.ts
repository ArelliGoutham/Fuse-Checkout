import type { EMICampaign } from '../schemas/emi-campaign';
import type { IINRange } from '../schemas/iin-range';

/**
 * Per-campaign redemption counters used to enforce caps.
 */
export interface RedemptionCounts {
  total_redemptions: number;
  merchant_redemptions: number;
  card_redemptions: number;
}

/**
 * Input for {@link validateCampaignEligibility}.
 */
export interface CampaignValidationInput {
  campaign: EMICampaign;
  cardInfo: IINRange;
  cartAmount: number;
  productSkus: string[];
  merchantId: string;
  redemptionCounts: RedemptionCounts;
  now: Date;
}

/**
 * Result of {@link validateCampaignEligibility}.
 */
export interface CampaignValidationResult {
  eligible: boolean;
  reason: string | null;
}

/**
 * Evaluates whether a card/cart combination qualifies for an EMI campaign.
 *
 * Checks are performed in a fixed order: status, IIN prefix, card tier,
 * product allow-list, merchant scope, campaign cap, per-merchant cap,
 * per-card cap, and the campaign date window. The first failing check
 * determines the rejection reason; all-pass returns eligible.
 *
 * @param input - Campaign, card, cart, merchant, counts, and current time
 * @returns Eligibility result with a human-readable reason on rejection
 */
export function validateCampaignEligibility(
  input: CampaignValidationInput,
): CampaignValidationResult {
  const { campaign, cardInfo, productSkus, merchantId, redemptionCounts, now } =
    input;

  if (campaign.status !== 'active') {
    return { eligible: false, reason: 'Campaign is inactive' };
  }

  if (!campaign.iin_prefixes.includes(cardInfo.prefix)) {
    return {
      eligible: false,
      reason: 'Card IIN does not match campaign eligible IINs',
    };
  }

  if (!campaign.card_tiers.includes(cardInfo.card_tier)) {
    return {
      eligible: false,
      reason: 'Card tier does not match campaign eligible tiers',
    };
  }

  if (
    campaign.products !== null &&
    !campaign.products.some((p) => productSkus.includes(p))
  ) {
    return {
      eligible: false,
      reason: 'Product does not match campaign eligible products',
    };
  }

  if (
    campaign.scope === 'merchant' &&
    campaign.merchant_id !== merchantId
  ) {
    return {
      eligible: false,
      reason: 'Campaign does not apply to this merchant',
    };
  }

  if (redemptionCounts.total_redemptions >= campaign.max_total) {
    return { eligible: false, reason: 'Campaign cap reached' };
  }

  if (
    campaign.max_per_merchant !== null &&
    redemptionCounts.merchant_redemptions >= campaign.max_per_merchant
  ) {
    return { eligible: false, reason: 'Per-merchant cap reached' };
  }

  if (redemptionCounts.card_redemptions >= campaign.max_per_card) {
    return { eligible: false, reason: 'Per-card limit reached' };
  }

  const startsAt = new Date(campaign.starts_at);
  const endsAt = new Date(campaign.ends_at);
  if (now < startsAt || now > endsAt) {
    return { eligible: false, reason: 'Campaign has expired or not yet started' };
  }

  return { eligible: true, reason: null };
}
