import type { RuleEvaluator } from './types';

export const brandRestriction: RuleEvaluator = (config, context) => {
  const { brands, exclude } = config as { brands: string[]; exclude: boolean };
  const hasMatchingBrand = context.cart.items.some(
    (item) => item.brand !== undefined && brands.includes(item.brand),
  );
  return exclude ? !hasMatchingBrand : hasMatchingBrand;
};
