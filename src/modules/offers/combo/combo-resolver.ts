import type { Offer } from '../schemas/offer';
import type { EvaluationResult, StackingPolicy } from '../schemas/evaluation';
import type { ComboResult, AppliedOffer, RejectedOffer } from '../schemas/combo';

interface ComboInput {
  offer: Offer;
  result: EvaluationResult;
}

export class ComboResolver {
  resolve(inputs: ComboInput[], policy: StackingPolicy, cartAmount: number): ComboResult {
    if (inputs.length === 0) {
      return { applied: [], rejected: [], total_discount: 0, final_amount: cartAmount };
    }

    // Sort by priority (desc), then by discount (desc)
    const sorted = [...inputs].sort((a, b) => {
      const priorityDiff = b.offer.stacking.priority - a.offer.stacking.priority;
      if (priorityDiff !== 0) return priorityDiff;
      return (b.result.discount?.amount ?? 0) - (a.result.discount?.amount ?? 0);
    });

    const applied: AppliedOffer[] = [];
    const rejected: RejectedOffer[] = [];
    const appliedOffers: Offer[] = []; // keep track of the actual offers for restrictions
    let couponCount = 0;
    let autoOfferCount = 0;
    let hasExclusive = false;
    const appliedTypes: string[] = [];

    for (const { offer, result } of sorted) {
      const discountAmount = result.discount?.amount ?? 0;

      if (hasExclusive) {
        rejected.push({ offer_id: offer._id, reason: 'Another exclusive offer is active' });
        continue;
      }

      if (offer.stacking.exclusive) {
        for (const a of applied) {
          rejected.push({ offer_id: a.offer_id, reason: 'Exclusive offer selected' });
        }
        applied.length = 0;
        appliedOffers.length = 0;
        appliedTypes.length = 0;
        couponCount = 0;
        autoOfferCount = 0;
        hasExclusive = true;
      }

      // Check exclusive tags: if an already-applied offer has an exclusive tag, reject this one
      const appliedHasExclusiveTag = appliedOffers.some((a) =>
        a.tags.some((tag) => policy.exclusive_tags.includes(tag)),
      );
      if (appliedHasExclusiveTag) {
        rejected.push({ offer_id: offer._id, reason: 'exclusive tag already applied' });
        continue;
      }

      // Check if THIS offer has exclusive tags and there are already applied offers
      const thisOfferHasExclusiveTag = offer.tags.some((tag) => policy.exclusive_tags.includes(tag));
      if (thisOfferHasExclusiveTag && applied.length > 0) {
        for (const a of applied) {
          rejected.push({ offer_id: a.offer_id, reason: `exclusive tag applied: ${offer.tags.join(', ')}` });
        }
        applied.length = 0;
        appliedOffers.length = 0;
        appliedTypes.length = 0;
        couponCount = 0;
        autoOfferCount = 0;
      }

      if (offer.type === 'coupon' && couponCount >= policy.max_coupons) {
        rejected.push({
          offer_id: offer._id,
          reason: `Exceeds max_coupons (${policy.max_coupons})`,
        });
        continue;
      }
      if (offer.type === 'auto_offer' && autoOfferCount >= policy.max_auto_offers) {
        rejected.push({
          offer_id: offer._id,
          reason: `Exceeds max_auto_offers (${policy.max_auto_offers})`,
        });
        continue;
      }

      if (!policy.allow_cross_type && applied.length > 0 && !appliedTypes.includes(offer.type)) {
        rejected.push({ offer_id: offer._id, reason: 'cross-type stacking not allowed' });
        continue;
      }

      // Check stacks_with: both the new offer and already-applied offers must agree
      let canStackWithApplied = true;
      if (applied.length > 0) {
        // Check if new offer can stack with applied offers
        if (offer.stacking.stacks_with !== null) {
          canStackWithApplied = appliedTypes.every((t) => offer.stacking.stacks_with?.includes(t));
        }

        // Check if already-applied offers can stack with this new offer
        if (canStackWithApplied) {
          for (const appliedOffer of appliedOffers) {
            if (appliedOffer.stacking.stacks_with !== null) {
              const offerCanStack = appliedOffer.stacking.stacks_with.includes(offer.type);
              if (!offerCanStack) {
                canStackWithApplied = false;
                break;
              }
            }
          }
        }

        if (!canStackWithApplied) {
          rejected.push({ offer_id: offer._id, reason: 'Restricted by stacks_with policy' });
          continue;
        }
      }

      applied.push({ offer_id: offer._id, discount_amount: discountAmount });
      appliedOffers.push(offer);
      appliedTypes.push(offer.type);
      if (offer.type === 'coupon') couponCount++;
      if (offer.type === 'auto_offer') autoOfferCount++;
    }

    let totalDiscount = applied.reduce((sum, a) => sum + a.discount_amount, 0);
    if (policy.max_total_discount !== null && totalDiscount > policy.max_total_discount) {
      totalDiscount = policy.max_total_discount;
    }
    totalDiscount = Math.min(totalDiscount, cartAmount);

    return {
      applied,
      rejected,
      total_discount: totalDiscount,
      final_amount: cartAmount - totalDiscount,
    };
  }
}

