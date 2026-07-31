import type { Db } from 'mongodb';

/**
 * Removes old alerts from pg_alerts collection.
 * Runs nightly to keep the alert database clean.
 * Retention period is configurable via ALERT_RETENTION_DAYS env var (default: 30 days).
 */
export async function cleanupOldAlerts(db: Db): Promise<{ deleted: number }> {
  const retentionDays = parseInt(process.env.ALERT_RETENTION_DAYS || '30', 10);
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

  const result = await db.collection('pg_alerts').deleteMany({
    created_at: { $lt: cutoff },
  });

  if (result.deletedCount > 0) {
    console.log(`[alerts] Cleaned up ${result.deletedCount} alerts older than ${retentionDays} days`);
  }

  return { deleted: result.deletedCount };
}

/**
 * Starts the alert cleanup cron job.
 * Runs once every 24 hours by default (configurable via ALERT_CLEANUP_CRON_MS).
 * @param db - MongoDB database instance
 * @param intervalMs - Cleanup interval (default: 24 hours from env)
 * @returns Cleanup function
 */
export function startAlertCleanupCron(db: Db, intervalMs?: number): () => void {
  const interval = intervalMs || parseInt(process.env.ALERT_CLEANUP_CRON_MS || '86400000', 10);

  // Run cleanup once immediately on startup, then on interval
  cleanupOldAlerts(db).catch(err => console.error('[alerts] Initial cleanup failed:', err));

  const timer = setInterval(async () => {
    try {
      await cleanupOldAlerts(db);
    } catch (err) {
      console.error('[alerts] Cleanup cron failed:', err);
    }
  }, interval);

  return () => clearInterval(timer);
}
