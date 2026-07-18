import type { Rule } from '../schemas/offer';
import type { EvaluationContext } from '../schemas/evaluation';
import type { RuleEvaluator } from './types';

/**
 * Registry that maps rule_type strings to their evaluator functions.
 * New rule types are added by calling register() — no modifications to existing code.
 */
export class RuleEvaluatorRegistry {
  private evaluators = new Map<string, RuleEvaluator>();

  register(ruleType: string, evaluator: RuleEvaluator): void {
    this.evaluators.set(ruleType, evaluator);
  }

  has(ruleType: string): boolean {
    return this.evaluators.has(ruleType);
  }

  evaluate(rule: Rule, context: EvaluationContext): boolean {
    const evaluator = this.evaluators.get(rule.rule_type);
    if (!evaluator) {
      throw new Error(`No evaluator registered for rule_type: ${rule.rule_type}`);
    }
    return evaluator(rule.config, context);
  }

  evaluateAll(
    rules: Rule[],
    context: EvaluationContext,
  ): { passed: boolean; failedRuleType: string | null } {
    for (const rule of rules) {
      if (!this.evaluate(rule, context)) {
        return { passed: false, failedRuleType: rule.rule_type };
      }
    }
    return { passed: true, failedRuleType: null };
  }
}
