import type { RuleEvaluator } from './types';

export const dateRange: RuleEvaluator = (config, context) => {
  const { start_date, end_date } = config as { start_date: string; end_date: string };
  const now = new Date(context.now);
  const start = new Date(`${start_date}T00:00:00.000Z`);
  const end = new Date(`${end_date}T23:59:59.999Z`);
  return now >= start && now <= end;
};
