export { config } from './config/index';
export { createOfferModule } from './modules/offers';
export type {
  OfferService, OfferRepository, Offer, Rule,
  EvaluationContext, EvaluationResult, StackingPolicy, ComputedDiscount,
  ComboResult, AppliedOffer, RejectedOffer,
  Cart, CartItem, CustomerContext, Discount,
} from './modules/offers';
