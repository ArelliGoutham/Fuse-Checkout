'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

interface Session {
  session_id: string;
  merchant_order_id: string | null;
  cart_amount: number;
  item_count: number;
  payment_status: string;
  payment_method: string | null;
  created_at: string;
  expires_at: string;
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterStatus, setFilterStatus] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (filterStatus) params.set('status', filterStatus);

    apiFetch(`/api/checkout/sessions?${params}`)
      .then(data => {
        setSessions(data.sessions || []);
        setTotalPages(data.pages || 1);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [page, filterStatus]);

  const handleRetry = async (sessionId: string) => {
    setActionLoading(sessionId);
    try {
      const result = await apiFetch(`/api/checkout/sessions/${sessionId}/retry`, { method: 'POST' });
      window.open(result.checkout_url || `/checkout/${result.session_id}`, '_blank');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retry');
    }
    setActionLoading(null);
  };

  const handleExpire = async (sessionId: string) => {
    setActionLoading(sessionId);
    try {
      await apiFetch(`/api/checkout/sessions/${sessionId}/expire`, { method: 'POST' });
      setSessions(prev => prev.map(s => s.session_id === sessionId ? { ...s, payment_status: 'expired' } : s));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to expire');
    }
    setActionLoading(null);
  };

  if (loading && !sessions.length) {
    return <div className="flex justify-center py-12"><i className="fa-solid fa-spinner fa-spin text-accent text-2xl"></i></div>;
  }

  const formatINR = (n: number) => '₹' + (n || 0).toLocaleString('en-IN');

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-info/10 text-info',
      processing: 'bg-accent/10 text-accent',
      success: 'bg-success/10 text-success',
      failed: 'bg-danger/10 text-danger',
      expired: 'bg-fg-muted/10 text-fg-muted',
    };
    return colors[status] || 'bg-surface-2 text-fg-muted';
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-fg">Checkout Sessions</h2>
        <p className="text-fg-muted text-sm mt-1">View and manage active checkout sessions</p>
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 text-danger text-sm">{error}</div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-3">
        <select
          value={filterStatus}
          onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
          className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-fg"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      {/* Sessions Table */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 text-xs font-semibold text-fg-muted uppercase">Session ID</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-fg-muted uppercase">Amount</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-fg-muted uppercase">Items</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-fg-muted uppercase">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-fg-muted uppercase">Created</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-fg-muted uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-fg-muted">No sessions found</td></tr>
            ) : sessions.map(s => (
              <tr key={s.session_id} className="border-b border-border-light last:border-0 hover:bg-surface-2">
                <td className="px-4 py-3 text-sm text-fg font-mono truncate max-w-xs">{s.session_id}</td>
                <td className="px-4 py-3 text-sm text-fg font-semibold">{formatINR(s.cart_amount)}</td>
                <td className="px-4 py-3 text-sm text-fg-soft text-center">{s.item_count}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${statusBadge(s.payment_status)}`}>
                    {s.payment_status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-fg-muted">{new Date(s.created_at).toLocaleDateString('en-IN')}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {(s.payment_status === 'failed' || s.payment_status === 'expired') && (
                      <button
                        onClick={() => handleRetry(s.session_id)}
                        disabled={actionLoading === s.session_id}
                        className="text-accent text-xs font-semibold hover:opacity-70 disabled:opacity-40"
                      >
                        {actionLoading === s.session_id ? '...' : 'Retry'}
                      </button>
                    )}
                    {s.payment_status === 'pending' && (
                      <button
                        onClick={() => handleExpire(s.session_id)}
                        disabled={actionLoading === s.session_id}
                        className="text-danger text-xs font-semibold hover:opacity-70 disabled:opacity-40"
                      >
                        {actionLoading === s.session_id ? '...' : 'Expire'}
                      </button>
                    )}
                    <Link
                      href={`http://localhost:8082/${s.session_id}`}
                      target="_blank"
                      className="text-fg-soft text-xs hover:text-accent"
                    >
                      <i className="fa-solid fa-external-link-alt"></i>
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
            className="px-3 py-2 rounded-lg bg-surface border border-border text-sm text-fg-soft disabled:opacity-40">
            Previous
          </button>
          <span className="text-sm text-fg-muted">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
            className="px-3 py-2 rounded-lg bg-surface border border-border text-sm text-fg-soft disabled:opacity-40">
            Next
          </button>
        </div>
      )}
    </div>
  );
}
