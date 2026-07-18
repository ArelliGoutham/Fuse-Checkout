import type { RuleEvaluator } from './types';

export const firstTimeBuyer: RuleEvaluator = (_config, context) => {
  return context.customer.total_orders === 0;
};
