import type { RuleEvaluator } from './types';

export const perCustomerLimit: RuleEvaluator = (config, context) => {
  const limit = (config as { limit: number }).limit;
  return context.usage.per_customer_used < limit;
};
