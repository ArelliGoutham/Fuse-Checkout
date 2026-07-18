import type { RuleEvaluator } from './types';

export const minCartValue: RuleEvaluator = (config, context) => {
  const minAmount = (config as { min_amount: number }).min_amount;
  return context.cart.amount >= minAmount;
};
