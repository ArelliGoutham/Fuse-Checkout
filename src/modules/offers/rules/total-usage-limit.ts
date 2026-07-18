import type { RuleEvaluator } from './types';

export const totalUsageLimit: RuleEvaluator = (config, context) => {
  const limit = (config as { limit: number }).limit;
  return context.usage.total_used < limit;
};
