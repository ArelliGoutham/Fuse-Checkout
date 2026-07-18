import type { RuleEvaluator } from './types';

const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export const timeWindow: RuleEvaluator = (config, context) => {
  const { days, start_hour, end_hour } = config as { days: string[]; start_hour: number; end_hour: number };
  const now = new Date(context.now);
  const dayName = DAY_NAMES[now.getUTCDay()];
  const hour = now.getUTCHours();
  return days.includes(dayName) && hour >= start_hour && hour <= end_hour;
};
