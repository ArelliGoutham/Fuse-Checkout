import type { Db } from 'mongodb';
import type { PGAdapter } from '../../pg-adapters/types';

/**
 * Routing decision from the smart router.
 */
export interface RoutingDecision {
  primary: PGAdapter;
  fallback: PGAdapter[];
  reason: string;
}

/**
 * Smart router that selects the best payment gateway based on rolling success rate.
 * Calculates per-merchant success rates from the pg_stats collection.
 * New PGs (no data) start at 100% success rate.
 * Falls back to next PG if primary fails.
 */
export class SmartRouter {
  constructor(
    private adapters: PGAdapter[],
    private db: Db
  ) {}

  /**
   * Routes a payment to the best available PG for this merchant.
   * @param merchantId - Merchant ID for per-merchant stats
   * @param _amount - Cart amount (reserved for amount-based routing in future)
   * @returns Routing decision with primary + fallback PGs
   */
  async route(merchantId: string, _amount: number): Promise<RoutingDecision> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const stats = await this.db.collection('pg_stats').find({
      merchant_id: merchantId,
      date: { $gte: sevenDaysAgo },
    }).toArray();

    // Calculate rolling success rate per PG
    const pgRates: Record<string, { total: number; success: number }> = {};
    for (const s of stats) {
      const name = s.pg_name as string;
      if (!pgRates[name]) pgRates[name] = { total: 0, success: 0 };
      pgRates[name].total += s.total_attempts as number;
      pgRates[name].success += s.successful as number;
    }

    // Rank adapters by success rate
    const ranked = this.adapters
      .map(adapter => {
        const r = pgRates[adapter.getName()];
        const rate = r && r.total > 0
          ? (r.success / r.total) * 100
          : 100; // New PGs start at 100%
        return { adapter, rate };
      })
      .sort((a, b) => b.rate - a.rate);

    const primary = ranked[0];
    const fallback = ranked.slice(1).map(r => r.adapter);

    return {
      primary: primary.adapter,
      fallback,
      reason: `${primary.adapter.getName()} has ${primary.rate.toFixed(1)}% success rate`,
    };
  }
}
