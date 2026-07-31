import type { Db } from 'mongodb';
import type { PGAlert } from '../schemas/pg-alert';

/**
 * Anomaly detection engine for PG health monitoring.
 * Runs as a periodic cron job, checks recent transaction_logs for anomalies,
 * and creates pg_alerts when thresholds are breached.
 *
 * All thresholds are env-configurable with sensible defaults.
 */
export class AnomalyDetectionEngine {
  private db: Db;

  // Configurable thresholds (env vars with defaults)
  private successRateThreshold: number;
  private latencyThresholdMs: number;
  private failureRateThreshold: number;
  private downtimeMinutes: number;

  constructor(db: Db) {
    this.db = db;
    this.successRateThreshold = parseFloat(process.env.ALERT_SUCCESS_RATE_THRESHOLD || '90');
    this.latencyThresholdMs = parseInt(process.env.ALERT_LATENCY_THRESHOLD_MS || '5000', 10);
    this.failureRateThreshold = parseFloat(process.env.ALERT_FAILURE_RATE_THRESHOLD || '20');
    this.downtimeMinutes = parseInt(process.env.ALERT_DOWNTIME_MINUTES || '30', 10);
  }

  /**
   * Runs all anomaly checks and creates alerts for any anomalies detected.
   * Only creates new alerts if there isn't already an active alert of the same
   * type for the same PG + merchant combination (deduplication).
   */
  async runChecks(): Promise<{ alertsCreated: number }> {
    const now = new Date();
    let alertsCreated = 0;

    alertsCreated += await this.checkSuccessRateDrop(now);
    alertsCreated += await this.checkLatencySpike(now);
    alertsCreated += await this.checkHighFailureRate(now);
    alertsCreated += await this.checkPgDowntime(now);
    alertsCreated += await this.checkAnomalySpike(now);

    return { alertsCreated };
  }

  /**
   * Detects PG success rate dropping below threshold in last 1 hour.
   */
  private async checkSuccessRateDrop(now: Date): Promise<number> {
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

    const results = await this.db.collection('transaction_logs').aggregate([
      { $match: { initiated_at: { $gte: oneHourAgo } } },
      {
        $group: {
          _id: { pg_name: '$pg_name', merchant_id: '$merchant_id' },
          total: { $sum: 1 },
          successful: { $sum: { $cond: [{ $eq: ['$payment_status', 'success'] }, 1, 0] } },
        },
      },
      { $match: { total: { $gte: 10 } } }, // Minimum 10 attempts to trigger
    ]).toArray();

    let count = 0;
    for (const r of results) {
      const successRate = (r.successful / r.total) * 100;
      if (successRate < this.successRateThreshold) {
        const created = await this.createAlert({
          type: 'success_rate_drop',
          severity: successRate < 70 ? 'critical' : 'warning',
          pg_name: r._id.pg_name,
          merchant_id: r._id.merchant_id,
          threshold: this.successRateThreshold,
          actual_value: Math.round(successRate * 100) / 100,
          message: `${r._id.pg_name} success rate dropped to ${Math.round(successRate)}% (threshold: ${this.successRateThreshold}%) in last hour`,
          window_minutes: 60,
        });
        if (created) count++;
      }
    }
    return count;
  }

  /**
   * Detects PG average latency exceeding threshold in last 15 minutes.
   */
  private async checkLatencySpike(now: Date): Promise<number> {
    const fifteenMinAgo = new Date(now.getTime() - 15 * 60 * 1000).toISOString();

    const results = await this.db.collection('transaction_logs').aggregate([
      { $match: { initiated_at: { $gte: fifteenMinAgo }, latency_ms: { $ne: null } } },
      {
        $group: {
          _id: { pg_name: '$pg_name', merchant_id: '$merchant_id' },
          avg_latency: { $avg: '$latency_ms' },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gte: 5 } } },
    ]).toArray();

    let count = 0;
    for (const r of results) {
      const avgLatency = r.avg_latency as number;
      if (avgLatency > this.latencyThresholdMs) {
        const created = await this.createAlert({
          type: 'latency_spike',
          severity: avgLatency > this.latencyThresholdMs * 2 ? 'critical' : 'warning',
          pg_name: r._id.pg_name,
          merchant_id: r._id.merchant_id,
          threshold: this.latencyThresholdMs,
          actual_value: Math.round(avgLatency),
          message: `${r._id.pg_name} average latency ${Math.round(avgLatency)}ms (threshold: ${this.latencyThresholdMs}ms) in last 15 min`,
          window_minutes: 15,
        });
        if (created) count++;
      }
    }
    return count;
  }

  /**
   * Detects high failure rate exceeding threshold in last hour.
   */
  private async checkHighFailureRate(now: Date): Promise<number> {
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

    const results = await this.db.collection('transaction_logs').aggregate([
      { $match: { initiated_at: { $gte: oneHourAgo } } },
      {
        $group: {
          _id: { pg_name: '$pg_name', merchant_id: '$merchant_id' },
          total: { $sum: 1 },
          failed: { $sum: { $cond: [{ $eq: ['$payment_status', 'failed'] }, 1, 0] } },
        },
      },
      { $match: { total: { $gte: 10 } } },
    ]).toArray();

    let count = 0;
    for (const r of results) {
      const failureRate = (r.failed / r.total) * 100;
      if (failureRate > this.failureRateThreshold) {
        const created = await this.createAlert({
          type: 'high_failure_rate',
          severity: failureRate > 50 ? 'critical' : 'warning',
          pg_name: r._id.pg_name,
          merchant_id: r._id.merchant_id,
          threshold: this.failureRateThreshold,
          actual_value: Math.round(failureRate * 100) / 100,
          message: `${r._id.pg_name} failure rate ${Math.round(failureRate)}% (threshold: ${this.failureRateThreshold}%) in last hour`,
          window_minutes: 60,
        });
        if (created) count++;
      }
    }
    return count;
  }

  /**
   * Detects PG with attempts but zero successes in the downtime window.
   */
  private async checkPgDowntime(now: Date): Promise<number> {
    const windowAgo = new Date(now.getTime() - this.downtimeMinutes * 60 * 1000).toISOString();

    const results = await this.db.collection('transaction_logs').aggregate([
      { $match: { initiated_at: { $gte: windowAgo } } },
      {
        $group: {
          _id: { pg_name: '$pg_name', merchant_id: '$merchant_id' },
          total: { $sum: 1 },
          successful: { $sum: { $cond: [{ $eq: ['$payment_status', 'success'] }, 1, 0] } },
        },
      },
      { $match: { total: { $gte: 3 }, successful: 0 } },
    ]).toArray();

    let count = 0;
    for (const r of results) {
      const created = await this.createAlert({
        type: 'pg_downtime',
        severity: 'critical',
        pg_name: r._id.pg_name,
        merchant_id: r._id.merchant_id,
        threshold: 0,
        actual_value: 0,
        message: `${r._id.pg_name} has ${r.total} attempts with 0 successes in last ${this.downtimeMinutes} min — possible downtime`,
        window_minutes: this.downtimeMinutes,
      });
      if (created) count++;
    }
    return count;
  }

  /**
   * Detects sudden spike in a specific error code (5+ occurrences in 5 minutes).
   */
  private async checkAnomalySpike(now: Date): Promise<number> {
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();

    const results = await this.db.collection('transaction_logs').aggregate([
      { $match: { initiated_at: { $gte: fiveMinAgo }, payment_status: 'failed', pg_error_message: { $ne: null } } },
      {
        $group: {
          _id: { pg_name: '$pg_name', merchant_id: '$merchant_id', error: '$pg_error_message' },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gte: 5 } } },
    ]).toArray();

    let count = 0;
    for (const r of results) {
      const errorMsg = (r._id.error as string || '').slice(0, 80);
      const created = await this.createAlert({
        type: 'anomaly_spike',
        severity: r.count >= 10 ? 'critical' : 'warning',
        pg_name: r._id.pg_name,
        merchant_id: r._id.merchant_id,
        threshold: 5,
        actual_value: r.count,
        message: `${r._id.pg_name} error spike: "${errorMsg}" — ${r.count} occurrences in 5 min`,
        error_code: null,
        error_count: r.count,
        window_minutes: 5,
      });
      if (created) count++;
    }
    return count;
  }

  /**
   * Creates an alert if there isn't already an active alert of the same type
   * for the same PG + merchant (deduplication).
   */
  private async createAlert(params: Omit<PGAlert, '_id' | 'status' | 'dismissed_at' | 'dismissed_by' | 'created_at'>): Promise<boolean> {
    // Check for existing active alert of same type + pg + merchant
    const existing = await this.db.collection('pg_alerts').findOne({
      type: params.type,
      pg_name: params.pg_name,
      merchant_id: params.merchant_id,
      status: 'active',
    });

    if (existing) return false; // Deduplicate — don't create duplicate active alerts

    const alert: PGAlert = {
      _id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      ...params,
      created_at: new Date().toISOString(),
      status: 'active',
      dismissed_at: null,
      dismissed_by: null,
    };

    await this.db.collection('pg_alerts').insertOne(alert as any);
    console.log(`[alerts] Created ${alert.severity} alert: ${alert.message}`);
    return true;
  }
}

/**
 * Starts the anomaly detection cron job.
 * @param db - MongoDB database instance
 * @param intervalMs - Check interval (default: 5 minutes from env)
 * @returns Cleanup function
 */
export function startAnomalyDetectionCron(db: Db, intervalMs?: number): () => void {
  const interval = intervalMs || parseInt(process.env.ALERT_CHECK_INTERVAL_MS || '300000', 10);
  const engine = new AnomalyDetectionEngine(db);

  const timer = setInterval(async () => {
    try {
      const result = await engine.runChecks();
      if (result.alertsCreated > 0) {
        console.log(`[alerts] ${result.alertsCreated} new alert(s) created`);
      }
    } catch (err) {
      console.error('[alerts] Anomaly detection failed:', err);
    }
  }, interval);

  return () => clearInterval(timer);
}
