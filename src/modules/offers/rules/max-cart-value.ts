import type { RuleEvaluator } from './types';

export const maxCartValue: RuleEvaluator = (config, context) => {
  const maxAmount = (config as { max_amount: number }).max_amount;
  return context.cart.amount <= maxAmount;
};
