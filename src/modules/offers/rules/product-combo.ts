import type { RuleEvaluator } from './types';

export const productCombo: RuleEvaluator = (config, context) => {
  const requiredSkus = (config as { skus: string[] }).skus;
  const cartSkus = context.cart.items.map((item) => item.sku_id);
  return requiredSkus.every((sku) => cartSkus.includes(sku));
};
