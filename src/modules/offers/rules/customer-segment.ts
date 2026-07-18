import type { RuleEvaluator } from './types';

export const customerSegment: RuleEvaluator = (config, context) => {
  const requiredSegments = (config as { segments: string[] }).segments;
  if (requiredSegments.length === 0) return true;
  return requiredSegments.some((s) => context.customer.segments.includes(s));
};
