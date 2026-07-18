import type { RuleEvaluator } from './types';

export const categoryRestriction: RuleEvaluator = (config, context) => {
  const { categories, exclude } = config as { categories: string[]; exclude: boolean };
  const hasMatchingCategory = context.cart.items.some(
    (item) => item.category !== undefined && categories.includes(item.category),
  );
  return exclude ? !hasMatchingCategory : hasMatchingCategory;
};
