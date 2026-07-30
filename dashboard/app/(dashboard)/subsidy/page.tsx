'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

interface SubsidyEntry {
  _id: string;
  order_id: string;
  campaign_code: string;
  brand: string | null;
  amount: number;
  emi_type: string;
  imei: string | null;
  imei_blocked: boolean;
  settlement_status: string;
  created_at: string;
}

interface Reconciliation {
  by_brand: Array<{
    brand: string;
    total_amount: number;
    entry_count: number;
    pending: number;
    imei_blocked: number;
    settled: number;
    paid: number;
  }>;
  total_pending: number;
  total_amount: number;
}

export default function SubsidyPage() {
  const [entries, setEntries] = useState<SubsidyEntry[]>([]);
  const [reconciliation, setReconciliation] = useState<Reconciliation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterStatus, setFilterStatus] = useState('');
  const [showImeiModal, setShowImeiModal] = useState<string | null>(null);
  const [imeiInput, setImeiInput] = useState('');
  const [settleModal, setSettleModal] = useState<string | null>(null);
  const [settleRef, setSettleRef] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = () => {
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (filterStatus) params.set('status', filterStatus);

    Promise.all([
      apiFetch(`/api/subsidy/ledger?${params}`),
      apiFetch('/api/subsidy/reconciliation'),
    ])
      .then(([ledgerData, reconData]) => {
        setEntries(ledgerData.entries || []);
        setTotalPages(ledgerData.pages || 1);
        setReconciliation(reconData);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [page, filterStatus]);

  const handleCaptureIMEI = async () => {
    if (!showImeiModal || !imeiInput) return;
    setActionLoading(true);
    try {
      await apiFetch(`/api/subsidy/${showImeiModal}/imei`, {
        method: 'POST',
        body: JSON.stringify({ imei: imeiInput }),
      });
      setShowImeiModal(null);
      setImeiInput('');
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to capture IMEI');
    }
    setActionLoading(false);
  };

  const handleSettle = async () => {
    if (!settleModal || !settleRef) return;
    setActionLoading(true);
    try {
      await apiFetch(`/api/subsidy/${settleModal}/settle`, {
        method: 'POST',
        body: JSON.stringify({ settlement_ref: settleRef }),
      });
      setSettleModal(null);
      setSettleRef('');
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark settled');
    }
    setActionLoading(false);
  };

  if (loading) {
    return <div className="flex justify-center py-12"><i className="fa-solid fa-spinner fa-spin text-accent text-2xl"></i></div>;
  }

  const formatINR = (n: number) => '₹' + (n || 0).toLocaleString('en-IN');

  const statusColors: Record<string, string> = {
    pending: 'bg-info/10 text-info',
    imei_blocked: 'bg-accent/10 text-accent',
    settled: 'bg-success/10 text-success',
    paid: 'bg-success/10 text-success',
    disputed: 'bg-danger/10 text-danger',
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-fg">Subsidy Ledger</h2>
        <p className="text-fg-muted text-sm mt-1">Brand subsidy settlement tracking — IMEI blocking and reconciliation</p>
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 text-danger text-sm">{error}</div>
      )}

      {/* Reconciliation Cards */}
      {reconciliation && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-surface border border-border rounded-xl p-5">
              <div className="text-2xl font-bold text-fg">{formatINR(reconciliation.total_amount)}</div>
              <div className="text-xs text-fg-muted mt-1">Total Subsidy Amount</div>
            </div>
            <div className="bg-surface border border-border rounded-xl p-5">
              <div className="text-2xl font-bold text-info">{reconciliation.total_pending}</div>
              <div className="text-xs text-fg-muted mt-1">Pending Settlements</div>
            </div>
            <div className="bg-surface border border-border rounded-xl p-5">
              <div className="text-2xl font-bold text-fg">{reconciliation.by_brand.length}</div>
              <div className="text-xs text-fg-muted mt-1">Brands</div>
            </div>
          </div>

          {/* Brand Breakdown */}
          {reconciliation.by_brand.map((brand, i) => (
            <div key={i} className="bg-surface border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
                    <i className="fa-solid fa-tag text-accent"></i>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-fg">{brand.brand}</h3>
                    <p className="text-xs text-fg-muted">{brand.entry_count} entries · {formatINR(brand.total_amount)}</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div className="text-center">
                  <div className="text-lg font-bold text-info">{brand.pending}</div>
                  <div className="text-xs text-fg-muted">Pending</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-accent">{brand.imei_blocked}</div>
                  <div className="text-xs text-fg-muted">IMEI Blocked</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-success">{brand.settled}</div>
                  <div className="text-xs text-fg-muted">Settled</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-success">{brand.paid}</div>
                  <div className="text-xs text-fg-muted">Paid</div>
                </div>
              </div>
            </div>
          ))}
        </div>
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
          <option value="imei_blocked">IMEI Blocked</option>
          <option value="settled">Settled</option>
          <option value="paid">Paid</option>
          <option value="disputed">Disputed</option>
        </select>
      </div>

      {/* Ledger Table */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 text-xs font-semibold text-fg-muted uppercase">Order ID</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-fg-muted uppercase">Brand</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-fg-muted uppercase">Campaign</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-fg-muted uppercase">Amount</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-fg-muted uppercase">IMEI</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-fg-muted uppercase">Status</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-fg-muted uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-fg-muted">No subsidy entries found</td></tr>
            ) : entries.map(e => (
              <tr key={e._id} className="border-b border-border-light last:border-0 hover:bg-surface-2">
                <td className="px-4 py-3 text-sm text-fg font-mono truncate max-w-xs">{e.order_id}</td>
                <td className="px-4 py-3 text-sm text-fg-soft">{e.brand || '—'}</td>
                <td className="px-4 py-3 text-sm text-fg-soft truncate max-w-xs">{e.campaign_code}</td>
                <td className="px-4 py-3 text-sm text-fg font-semibold text-right">{formatINR(e.amount)}</td>
                <td className="px-4 py-3 text-center">
                  {e.imei ? (
                    <span className="text-xs text-fg-soft font-mono">{e.imei.slice(0, 6)}•••••</span>
                  ) : (
                    <span className="text-xs text-fg-muted">Not captured</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${statusColors[e.settlement_status] || 'bg-surface-2 text-fg-muted'}`}>
                    {e.settlement_status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {e.settlement_status === 'pending' && (
                    <button
                      onClick={() => setShowImeiModal(e.order_id)}
                      className="text-accent text-xs font-semibold hover:opacity-70"
                    >
                      Capture IMEI
                    </button>
                  )}
                  {e.settlement_status === 'imei_blocked' && (
                    <button
                      onClick={() => setSettleModal(e.order_id)}
                      className="text-success text-xs font-semibold hover:opacity-70"
                    >
                      Mark Settled
                    </button>
                  )}
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

      {/* IMEI Capture Modal */}
      {showImeiModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowImeiModal(null)}>
          <div className="bg-surface border border-border rounded-2xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-fg mb-4">Capture IMEI</h3>
            <p className="text-sm text-fg-muted mb-4">Enter the 15-digit IMEI number from the device. This will be blocked via the OEM API.</p>
            <input
              type="text"
              placeholder="35-209900-176148-1"
              value={imeiInput}
              onChange={e => setImeiInput(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-lg px-4 py-3 text-sm text-fg font-mono mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => setShowImeiModal(null)} className="flex-1 px-4 py-3 rounded-lg border border-border text-sm text-fg-soft hover:bg-surface-2">Cancel</button>
              <button onClick={handleCaptureIMEI} disabled={actionLoading || !imeiInput}
                className="flex-1 px-4 py-3 rounded-lg bg-accent text-bg font-semibold text-sm disabled:opacity-50">
                {actionLoading ? 'Blocking...' : 'Block IMEI'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settle Modal */}
      {settleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSettleModal(null)}>
          <div className="bg-surface border border-border rounded-2xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-fg mb-4">Mark Settled</h3>
            <p className="text-sm text-fg-muted mb-4">Enter the brand's settlement reference number (bank transfer reference, UTR, etc.).</p>
            <input
              type="text"
              placeholder="UTR/Reference number"
              value={settleRef}
              onChange={e => setSettleRef(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-lg px-4 py-3 text-sm text-fg mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => setSettleModal(null)} className="flex-1 px-4 py-3 rounded-lg border border-border text-sm text-fg-soft hover:bg-surface-2">Cancel</button>
              <button onClick={handleSettle} disabled={actionLoading || !settleRef}
                className="flex-1 px-4 py-3 rounded-lg bg-success text-bg font-semibold text-sm disabled:opacity-50">
                {actionLoading ? 'Saving...' : 'Confirm Settled'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
