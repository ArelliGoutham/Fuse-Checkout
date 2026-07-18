import type { EvaluationContext } from '../schemas/evaluation';

/**
 * A rule evaluator is a pure function that checks one rule against the context.
 * Returns true if the rule passes, false if it fails.
 */
export type RuleEvaluator = (
  config: Record<string, unknown>,
  context: EvaluationContext,
) => boolean;
