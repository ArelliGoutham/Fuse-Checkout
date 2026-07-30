import type { Db } from 'mongodb';

/**
 * Aggregates transaction logs into daily PG stats per merchant.
 * Calculates success rates, latency, volume, and failure breakdowns.
 * Called after each payment attempt or via a cron job.
 */
export class PGStatsAggregator {
  constructor(private db: Db) {}

  /**
   * Aggregates stats for a specific PG + merchant + date combination.
   * Reads all transaction_logs for that day and writes/upserts pg_stats.
   *
   * @param pgName - PG name (e.g., "razorpay")
   * @param merchantId - Merchant ID
   * @param date - Date string in YYYY-MM-DD format
   */
  async aggregate(pgName: string, merchantId: string, date: string): Promise<void> {
    const dayStart = `${date}T00:00:00.000Z`;
    const dayEnd = `${date}T23:59:59.999Z`;

    const logs = await this.db.collection('transaction_logs').find({
      pg_name: pgName,
      merchant_id: merchantId,
      initiated_at: { $gte: dayStart, $lte: dayEnd },
    }).toArray();

    const total = logs.length;
    const successful = logs.filter(l => l.payment_status === 'success').length;
    const failed = logs.filter(l => l.payment_status === 'failed').length;
    const pending = total - successful - failed;

    const latencies = logs
      .filter(l => typeof l.latency_ms === 'number')
      .map(l => l.latency_ms as number);
    const avgLatency = latencies.length > 0
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : 0;
    const p95Latency = latencies.length > 0
      ? this.percentile(latencies, 95)
      : 0;

    const totalVolume = logs
      .filter(l => l.payment_status === 'success')
      .reduce((sum, l) => sum + (l.amount as number), 0);

    const failuresByReason: Record<string, number> = {};
    for (const l of logs) {
      if (l.payment_status === 'failed' && l.pg_error_message) {
        const reason = l.pg_error_message.slice(0, 50);
        failuresByReason[reason] = (failuresByReason[reason] || 0) + 1;
      }
    }

    const statsId = `${pgName}_${merchantId}_${date}`;

    await this.db.collection('pg_stats').updateOne(
      { _id: statsId as any },
      {
        $set: {
          pg_name: pgName,
          merchant_id: merchantId,
          date,
          total_attempts: total,
          successful,
          failed,
          pending,
          success_rate: total > 0 ? Math.round((successful / total) * 10000) / 100 : 0,
          avg_latency_ms: avgLatency,
          p95_latency_ms: p95Latency,
          total_volume: totalVolume as number,
          avg_order_value: successful > 0 ? Math.round((totalVolume as number) / successful) : 0,
          failures_by_reason: failuresByReason,
          updated_at: new Date().toISOString(),
        },
      },
      { upsert: true }
    );
  }

  /**
   * Aggregates stats for all PGs + merchants for a given date.
   * Useful as a cron job.
   */
  async aggregateAllForDate(date: string): Promise<void> {
    const distinctPairs = await this.db.collection('transaction_logs').distinct(
      'pg_name',
      { initiated_at: { $gte: `${date}T00:00:00.000Z`, $lte: `${date}T23:59:59.999Z` } }
    );

    const merchants = await this.db.collection('transaction_logs').distinct(
      'merchant_id',
      { initiated_at: { $gte: `${date}T00:00:00.000Z`, $lte: `${date}T23:59:59.999Z` } }
    );

    for (const pgName of distinctPairs) {
      for (const merchantId of merchants) {
        await this.aggregate(pgName, merchantId, date);
      }
    }
  }

  /**
   * Calculates the nth percentile of an array of numbers.
   */
  private percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }
}
