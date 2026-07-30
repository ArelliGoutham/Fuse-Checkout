import type { RuleEvaluator } from './types';

export const paymentMethodRestriction: RuleEvaluator = (config, context) => {
  const { payment_types, banks, card_tiers, iin_prefixes } = config as {
    payment_types: string[];
    banks?: string[];
    card_tiers?: string[];
    iin_prefixes?: string[];
  };

  // No payment context = can't evaluate payment-based rules
  if (!context.payment) {
    return false;
  }

  // Check payment type (card, upi, bank_transfer)
  if (payment_types && payment_types.length > 0) {
    if (!payment_types.includes(context.payment.method)) {
      return false;
    }
  }

  // Check bank (HDFC, ICICI, etc.) — from BIN lookup
  if (banks && banks.length > 0) {
    if (!context.payment.bank || !banks.includes(context.payment.bank)) {
      return false;
    }
  }

  // Check card tier (platinum, signature, etc.) — from IIN database
  if (card_tiers && card_tiers.length > 0) {
    if (!context.payment.card_tier || !card_tiers.includes(context.payment.card_tier)) {
      return false;
    }
  }

  // Check IIN prefix (6-digit BIN)
  if (iin_prefixes && iin_prefixes.length > 0) {
    if (!context.payment.iin_prefix || !iin_prefixes.includes(context.payment.iin_prefix)) {
      return false;
    }
  }

  return true;
};
