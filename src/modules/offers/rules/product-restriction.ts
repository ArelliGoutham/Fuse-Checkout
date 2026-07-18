import type { RuleEvaluator } from './types';

export const productRestriction: RuleEvaluator = (config, context) => {
  const { skus, exclude } = config as { skus: string[]; exclude: boolean };
  const hasMatchingSku = context.cart.items.some((item) => skus.includes(item.sku_id));
  return exclude ? !hasMatchingSku : hasMatchingSku;
};
