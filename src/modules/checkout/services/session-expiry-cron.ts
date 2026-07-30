import type { Db } from 'mongodb';

/**
 * Expires checkout sessions that have passed their expires_at timestamp.
 * Called periodically (every 5 minutes via cron or interval).
 * Only expires sessions in 'pending' state — processing/success/failed are left alone.
 */
export async function expireSessions(db: Db): Promise<{ expired: number }> {
  const now = new Date().toISOString();

  const result = await db.collection('checkout_sessions').updateMany(
    {
      payment_status: 'pending',
      expires_at: { $lt: now },
    },
    {
      $set: {
        payment_status: 'expired',
        updated_at: now,
      },
    }
  );

  if (result.modifiedCount > 0) {
    // Log to audit
    await db.collection('session_audit_logs').insertOne({
      _id: `audit_expire_${now}` as any,
      session_id: 'batch',
      merchant_id: 'system',
      action: 'expired',
      previous_state: 'pending',
      new_state: 'expired',
      changed_by: 'system',
      metadata: { count: result.modifiedCount, triggered_at: now },
      timestamp: now,
    });
  }

  return { expired: result.modifiedCount };
}

/**
 * Starts a session expiry interval that runs every 5 minutes.
 * Returns a cleanup function to clear the interval.
 *
 * @param db - MongoDB database instance
 * @param intervalMs - Interval in milliseconds (default: 5 minutes)
 * @returns Cleanup function
 */
export function startSessionExpiryCron(db: Db, intervalMs: number = 5 * 60 * 1000): () => void {
  const interval = setInterval(async () => {
    try {
      const result = await expireSessions(db);
      if (result.expired > 0) {
        console.log(`[cron] Expired ${result.expired} abandoned sessions`);
      }
    } catch (err) {
      console.error('[cron] Session expiry failed:', err);
    }
  }, intervalMs);

  return () => clearInterval(interval);
}
