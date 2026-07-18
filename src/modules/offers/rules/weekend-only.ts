import type { RuleEvaluator } from './types';

export const weekendOnly: RuleEvaluator = (_config, context) => {
  const day = new Date(context.now).getUTCDay();
  return day === 0 || day === 6;
};
