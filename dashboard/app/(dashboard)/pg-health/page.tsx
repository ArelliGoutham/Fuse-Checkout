'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

interface PGHealth {
  pg_name: string;
  total_attempts_1h: number;
  successful_1h: number;
  failed_1h: number;
  success_rate_1h: number;
  success_rate_24h: number;
  avg_latency_ms_1h: number;
  trend: string;
  status: string;
}

interface Alert {
  _id: string;
  type: string;
  severity: string;
  pg_name: string;
  message: string;
  actual_value: number;
  threshold: number;
  created_at: string;
  status: string;
}

interface HealthData {
  active_alerts: number;
  alerts_by_severity: Record<string, number>;
  pg_health: PGHealth[];
}

export default function PGHealthPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dismissing, setDismissing] = useState<string | null>(null);

  const loadData = () => {
    Promise.all([
      apiFetch('/api/admin/pg-health'),
      apiFetch('/api/admin/alerts?status=active&limit=50'),
    ])
      .then(([healthData, alertsData]) => {
        setHealth(healthData);
        setAlerts(alertsData.alerts || []);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000); // Refresh every 60s
    return () => clearInterval(interval);
  }, []);

  const handleDismiss = async (alertId: string) => {
    setDismissing(alertId);
    try {
      await apiFetch(`/api/admin/alerts/${alertId}/dismiss`, { method: 'POST' });
      setAlerts(prev => prev.filter(a => a._id !== alertId));
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to dismiss alert');
    }
    setDismissing(null);
  };

  if (loading) {
    return <div className="flex justify-center py-12"><i className="fa-solid fa-spinner fa-spin text-accent text-2xl"></i></div>;
  }

  const severityColors: Record<string, string> = {
    critical: 'bg-danger/10 text-danger border-danger/20',
    warning: 'bg-accent/10 text-accent border-accent/20',
    info: 'bg-info/10 text-info border-info/20',
  };

  const statusColors: Record<string, string> = {
    healthy: 'bg-success/10 text-success',
    degraded: 'bg-accent/10 text-accent',
    critical: 'bg-danger/10 text-danger',
  };

  const trendIcons: Record<string, string> = {
    improving: 'fa-arrow-trend-up text-success',
    declining: 'fa-arrow-trend-down text-danger',
    stable: 'fa-minus text-fg-muted',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-fg">PG Health Monitor</h2>
          <p className="text-fg-muted text-sm mt-1">Real-time payment gateway performance and anomaly alerts</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-fg-muted">
          <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
          <span>Auto-refreshing every 60s</span>
        </div>
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 text-danger text-sm">{error}</div>
      )}

      {/* Alert Summary */}
      {health && health.active_alerts > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="text-2xl font-bold text-danger">{health.active_alerts}</div>
            <div className="text-xs text-fg-muted mt-1">Active Alerts</div>
          </div>
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="text-2xl font-bold text-accent">{health.alerts_by_severity.warning || 0}</div>
            <div className="text-xs text-fg-muted mt-1">Warnings</div>
          </div>
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="text-2xl font-bold text-danger">{health.alerts_by_severity.critical || 0}</div>
            <div className="text-xs text-fg-muted mt-1">Critical</div>
          </div>
        </div>
      )}

      {/* Active Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-fg">Active Alerts ({alerts.length})</h3>
          {alerts.map(alert => (
            <div
              key={alert._id}
              className={`border rounded-xl p-4 flex items-center justify-between ${severityColors[alert.severity] || severityColors.info}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center flex-shrink-0">
                  <i className={`fa-solid ${alert.type === 'pg_downtime' ? 'fa-server-slash' : alert.type === 'latency_spike' ? 'fa-clock' : 'fa-triangle-exclamation'}`}></i>
                </div>
                <div>
                  <div className="text-sm font-semibold">{alert.message}</div>
                  <div className="text-xs opacity-70 mt-0.5">
                    {new Date(alert.created_at).toLocaleString('en-IN')} · 
                    <span className="capitalize ml-1">{alert.type.replace(/_/g, ' ')}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleDismiss(alert._id)}
                disabled={dismissing === alert._id}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-2 transition disabled:opacity-40"
              >
                {dismissing === alert._id ? '...' : 'Dismiss'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* PG Health Table */}
      {health && health.pg_health.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-6">
          <h3 className="text-sm font-semibold text-fg mb-4">Payment Gateway Performance (Last 1 Hour)</h3>
          <div className="space-y-3">
            {health.pg_health.map((pg, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-surface-2 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-surface rounded-lg flex items-center justify-center">
                    <i className="fa-solid fa-server text-fg-muted"></i>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-fg capitalize">{pg.pg_name}</div>
                    <div className="text-xs text-fg-muted">
                      {pg.total_attempts_1h} attempts · {pg.successful_1h} success · {pg.failed_1h} failed
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  {/* Success Rate */}
                  <div className="text-right">
                    <div className={`text-lg font-bold ${pg.success_rate_1h >= 90 ? 'text-success' : pg.success_rate_1h >= 70 ? 'text-accent' : 'text-danger'}`}>
                      {pg.success_rate_1h}%
                    </div>
                    <div className="text-xs text-fg-muted">24h: {pg.success_rate_24h}%</div>
                  </div>
                  {/* Trend */}
                  <div className="text-center">
                    <i className={`fa-solid ${trendIcons[pg.trend] || trendIcons.stable} text-lg`}></i>
                    <div className="text-xs text-fg-muted capitalize mt-1">{pg.trend}</div>
                  </div>
                  {/* Latency */}
                  <div className="text-right">
                    <div className="text-sm font-semibold text-fg">{pg.avg_latency_ms_1h}ms</div>
                    <div className="text-xs text-fg-muted">avg latency</div>
                  </div>
                  {/* Status Badge */}
                  <span className={`inline-block px-3 py-1.5 rounded-full text-xs font-semibold capitalize ${statusColors[pg.status] || statusColors.healthy}`}>
                    {pg.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Data */}
      {health && health.pg_health.length === 0 && alerts.length === 0 && (
        <div className="bg-surface border border-border rounded-xl p-12 text-center">
          <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fa-solid fa-check-circle text-success text-2xl"></i>
          </div>
          <h3 className="text-sm font-semibold text-fg">All systems healthy</h3>
          <p className="text-fg-muted text-sm mt-1">No active alerts and no payment gateway issues detected.</p>
        </div>
      )}
    </div>
  );
}
