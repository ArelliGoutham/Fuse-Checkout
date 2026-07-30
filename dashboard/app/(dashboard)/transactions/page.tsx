'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

interface Transaction {
  _id: string;
  order_id: string;
  pg_name: string;
  pg_order_id: string | null;
  pg_payment_id: string | null;
  amount: number;
  payment_method: string;
  payment_status: string;
  routing_reason: string;
  is_fallback: boolean;
  latency_ms: number | null;
  initiated_at: string;
}

interface AnalyticsData {
  total_attempts: number;
  successful: number;
  failed: number;
  success_rate: number;
  total_volume: number;
  avg_order_value: number;
  avg_latency_ms: number;
  pg_breakdown: Array<{
    pg_name: string;
    attempts: number;
    successful: number;
    success_rate: number;
    volume: number;
    avg_latency_ms: number;
  }>;
  payment_methods: Array<{
    method: string;
    count: number;
    success_rate: number;
  }>;
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPg, setFilterPg] = useState('');

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (filterStatus) params.set('status', filterStatus);
    if (filterPg) params.set('pg_name', filterPg);

    Promise.all([
      apiFetch(`/api/transactions?${params}`),
      apiFetch('/api/transactions/analytics'),
    ])
      .then(([txData, analyticsData]) => {
        setTransactions(txData.transactions || []);
        setTotalPages(txData.pages || 1);
        setAnalytics(analyticsData);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [page, filterStatus, filterPg]);

  if (loading && !transactions.length) {
    return <div className="flex justify-center py-12"><i className="fa-solid fa-spinner fa-spin text-accent text-2xl"></i></div>;
  }

  const formatINR = (n: number) => '₹' + (n || 0).toLocaleString('en-IN');

  const metrics = [
    { label: 'Total Attempts', value: (analytics?.total_attempts ?? 0).toLocaleString(), icon: 'fa-rotate', color: 'text-accent', bg: 'bg-accent/10' },
    { label: 'Success Rate', value: `${analytics?.success_rate ?? 0}%`, icon: 'fa-check-circle', color: 'text-success', bg: 'bg-success/10' },
    { label: 'Total Volume', value: formatINR(analytics?.total_volume ?? 0), icon: 'fa-indian-rupee-sign', color: 'text-info', bg: 'bg-info/10' },
    { label: 'Avg Latency', value: `${analytics?.avg_latency_ms ?? 0}ms`, icon: 'fa-clock', color: 'text-purple', bg: 'bg-purple/10' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-fg">Transactions</h2>
        <p className="text-fg-muted text-sm mt-1">Every payment attempt across all payment gateways</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-4 gap-4">
        {metrics.map(m => (
          <div key={m.label} className="bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 ${m.bg} rounded-lg flex items-center justify-center`}>
                <i className={`fa-solid ${m.icon} ${m.color}`}></i>
              </div>
            </div>
            <div className="text-2xl font-bold text-fg">{m.value}</div>
            <div className="text-xs text-fg-muted mt-1">{m.label}</div>
          </div>
        ))}
      </div>

      {/* PG Breakdown */}
      {analytics?.pg_breakdown && analytics.pg_breakdown.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-6">
          <h3 className="text-sm font-semibold text-fg mb-4">PG Performance</h3>
          <div className="space-y-3">
            {analytics.pg_breakdown.map((pg, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-border-light last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-surface-2 rounded-lg flex items-center justify-center">
                    <i className="fa-solid fa-server text-fg-muted text-xs"></i>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-fg capitalize">{pg.pg_name}</div>
                    <div className="text-xs text-fg-muted">{pg.attempts} attempts · {formatINR(pg.volume)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm font-semibold text-success">{pg.success_rate}%</div>
                    <div className="text-xs text-fg-muted">{pg.avg_latency_ms}ms avg</div>
                  </div>
                  <div className="w-24 h-2 bg-surface-2 rounded-full overflow-hidden">
                    <div className="h-full bg-success rounded-full" style={{ width: `${pg.success_rate}%` }}></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <select
          value={filterStatus}
          onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
          className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-fg"
        >
          <option value="">All statuses</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
          <option value="pending">Pending</option>
        </select>
        <select
          value={filterPg}
          onChange={e => { setFilterPg(e.target.value); setPage(1); }}
          className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-fg"
        >
          <option value="">All gateways</option>
          <option value="razorpay">Razorpay</option>
          <option value="mock">Mock</option>
        </select>
      </div>

      {/* Transactions Table */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 text-xs font-semibold text-fg-muted uppercase">Order ID</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-fg-muted uppercase">PG</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-fg-muted uppercase">Method</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-fg-muted uppercase">Amount</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-fg-muted uppercase">Status</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-fg-muted uppercase">Latency</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-fg-muted uppercase">Date</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-fg-muted">No transactions yet</td></tr>
            ) : transactions.map(tx => (
              <tr key={tx._id} className="border-b border-border-light last:border-0 hover:bg-surface-2">
                <td className="px-4 py-3 text-sm text-fg font-mono">{tx.order_id}</td>
                <td className="px-4 py-3 text-sm text-fg-soft capitalize">{tx.pg_name}</td>
                <td className="px-4 py-3 text-sm text-fg-soft">{tx.payment_method}</td>
                <td className="px-4 py-3 text-sm text-fg font-semibold text-right">{formatINR(tx.amount)}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold ${
                    tx.payment_status === 'success'
                      ? 'bg-success/10 text-success'
                      : tx.payment_status === 'failed'
                        ? 'bg-danger/10 text-danger'
                        : 'bg-info/10 text-info'
                  }`}>
                    {tx.payment_status === 'success' && <i className="fa-solid fa-check text-[10px]"></i>}
                    {tx.payment_status === 'failed' && <i className="fa-solid fa-xmark text-[10px]"></i>}
                    {tx.payment_status}
                    {tx.is_fallback && <span className="text-fg-muted">↻</span>}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-fg-muted text-right">{tx.latency_ms ? `${tx.latency_ms}ms` : '—'}</td>
                <td className="px-4 py-3 text-sm text-fg-muted">{new Date(tx.initiated_at).toLocaleDateString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-3 py-2 rounded-lg bg-surface border border-border text-sm text-fg-soft disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-sm text-fg-muted">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-3 py-2 rounded-lg bg-surface border border-border text-sm text-fg-soft disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
