'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

interface Order {
  _id: string;
  merchant_order_id: string | null;
  pg_name: string;
  final_amount: number;
  order_status: string;
  payment_method: string;
  created_at: string;
}

type ModalMode = 'freeform' | 'catalog';

interface CreateLinkResponse {
  checkout_url: string;
  session_id: string;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterStatus, setFilterStatus] = useState('');

  // Create link modal state
  const [showModal, setShowModal] = useState(false);
  const [linkMode, setLinkMode] = useState<ModalMode>('freeform');
  const [productName, setProductName] = useState('');
  const [amount, setAmount] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [merchantOrderId, setMerchantOrderId] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (filterStatus) params.set('status', filterStatus);

    apiFetch(`/api/orders?${params}`)
      .then(data => {
        setOrders(data.orders || []);
        setTotalPages(data.pages || 1);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [page, filterStatus]);

  const formatINR = (n: number) => '₹' + (n || 0).toLocaleString('en-IN');

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      paid: 'bg-success/10 text-success',
      failed: 'bg-danger/10 text-danger',
      refunded: 'bg-orange-500/10 text-orange-500',
      created: 'bg-info/10 text-info',
    };
    return map[status] || 'bg-surface-2 text-fg-muted';
  };

  const resetModal = () => {
    setShowModal(false);
    setLinkMode('freeform');
    setProductName('');
    setAmount('');
    setQuantity('1');
    setMerchantOrderId('');
    setCreatedUrl(null);
    setCopied(false);
    setFormError(null);
  };

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (linkMode === 'catalog') return;

    if (!productName || !amount) {
      setFormError('Product name and amount are required');
      return;
    }

    const numAmount = parseFloat(amount);
    const numQty = parseInt(quantity, 10) || 1;

    if (isNaN(numAmount) || numAmount <= 0) {
      setFormError('Amount must be a positive number');
      return;
    }

    setCreating(true);
    try {
      const body: Record<string, unknown> = {
        cart: {
          amount: numAmount * numQty,
          items: [{
            sku_id: 'MANUAL',
            name: productName,
            price: numAmount,
            qty: numQty,
          }],
        },
        redirect_urls: {
          success: 'https://example.com/success',
          cancel: 'https://example.com/cancel',
        },
      };
      if (merchantOrderId) body.merchant_order_id = merchantOrderId;

      const data = await apiFetch('/api/checkout/sessions', {
        method: 'POST',
        body: JSON.stringify(body),
      }) as CreateLinkResponse;

      setCreatedUrl(data.checkout_url || data.session_id || '');
      setCopied(false);

      // Refresh orders list
      apiFetch(`/api/orders?page=${page}&limit=20`)
        .then(d => {
          setOrders(d.orders || []);
          setTotalPages(d.pages || 1);
        })
        .catch(() => {});
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create payment link');
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = () => {
    if (!createdUrl) return;
    navigator.clipboard.writeText(createdUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading && !orders.length) {
    return <div className="flex justify-center py-12"><i className="fa-solid fa-spinner fa-spin text-accent text-2xl"></i></div>;
  }

  if (error) {
    return <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 text-danger">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-fg">Orders</h2>
          <p className="text-fg-muted text-sm mt-1">All orders across all payment gateways</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-bg font-semibold px-4 py-2 rounded-lg transition"
        >
          <i className="fa-solid fa-link text-xs"></i>
          Create Payment Link
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <select
          value={filterStatus}
          onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
          className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-fg"
        >
          <option value="">All statuses</option>
          <option value="created">Created</option>
          <option value="paid">Paid</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </select>
      </div>

      {/* Orders Table */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 text-xs font-semibold text-fg-muted uppercase">Order ID</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-fg-muted uppercase">Merchant Order ID</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-fg-muted uppercase">PG</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-fg-muted uppercase">Amount</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-fg-muted uppercase">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-fg-muted uppercase">Payment Method</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-fg-muted uppercase">Date</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-fg-muted">No orders yet</td></tr>
            ) : orders.map(order => (
              <tr key={order._id} className="border-b border-border-light last:border-0 hover:bg-surface-2">
                <td className="px-4 py-3 text-sm text-fg font-mono">
                  <Link href={`/orders/${order._id}`} className="hover:text-accent transition">{order._id}</Link>
                </td>
                <td className="px-4 py-3 text-sm text-fg-soft">{order.merchant_order_id || '—'}</td>
                <td className="px-4 py-3 text-sm text-fg-soft capitalize">{order.pg_name}</td>
                <td className="px-4 py-3 text-sm text-fg font-semibold text-right">{formatINR(order.final_amount)}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold ${statusBadge(order.order_status)}`}>
                    {order.order_status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-fg-soft">{order.payment_method || '—'}</td>
                <td className="px-4 py-3 text-sm text-fg-muted">{new Date(order.created_at).toLocaleDateString('en-IN')}</td>
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

      {/* Create Payment Link Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={resetModal}>
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-fg">Create Payment Link</h3>
              <button onClick={resetModal} className="text-fg-muted hover:text-fg transition">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {createdUrl ? (
              /* Success: Show checkout URL */
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-success">
                  <i className="fa-solid fa-circle-check"></i>
                  <span className="font-semibold">Payment link created!</span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-fg mb-1.5">Checkout URL</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={createdUrl}
                      className="flex-1 bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-fg font-mono"
                    />
                    <button
                      onClick={handleCopy}
                      className="px-3 py-2 bg-accent hover:bg-accent-hover text-bg rounded-lg text-sm font-semibold transition"
                    >
                      {copied ? <i className="fa-solid fa-check"></i> : 'Copy Link'}
                    </button>
                  </div>
                </div>
                <button
                  onClick={resetModal}
                  className="w-full bg-surface-2 hover:bg-border text-fg font-semibold py-2 rounded-lg transition"
                >
                  Done
                </button>
              </div>
            ) : (
              /* Form */
              <>
                {/* Toggle */}
                <div className="flex gap-2 mb-4 p-1 bg-surface-2 rounded-lg">
                  <button
                    onClick={() => setLinkMode('freeform')}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${linkMode === 'freeform' ? 'bg-accent text-bg' : 'text-fg-soft hover:text-fg'}`}
                  >
                    Freeform
                  </button>
                  <button
                    onClick={() => setLinkMode('catalog')}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${linkMode === 'catalog' ? 'bg-accent text-bg' : 'text-fg-soft hover:text-fg'}`}
                  >
                    From Catalog
                  </button>
                </div>

                {linkMode === 'catalog' ? (
                  <div className="py-12 text-center">
                    <i className="fa-solid fa-box-open text-fg-muted text-3xl mb-3"></i>
                    <p className="text-fg-muted text-sm">Coming soon</p>
                    <p className="text-fg-muted text-xs mt-1">Catalog integration in a future release</p>
                  </div>
                ) : (
                  <form onSubmit={handleCreateLink}>
                    {formError && (
                      <div className="bg-danger/10 border border-danger/20 rounded-lg p-3 text-danger text-sm mb-4">
                        <i className="fa-solid fa-circle-exclamation mr-2"></i>{formError}
                      </div>
                    )}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-fg mb-1.5">Product Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Premium T-Shirt"
                        value={productName}
                        onChange={e => setProductName(e.target.value)}
                        className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-fg placeholder-fg-muted focus:border-accent/50 outline-none transition"
                      />
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-fg mb-1.5">Amount (₹)</label>
                      <input
                        type="number"
                        min="1"
                        step="0.01"
                        placeholder="499"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-fg placeholder-fg-muted focus:border-accent/50 outline-none transition"
                      />
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-fg mb-1.5">Quantity</label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        placeholder="1"
                        value={quantity}
                        onChange={e => setQuantity(e.target.value)}
                        className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-fg placeholder-fg-muted focus:border-accent/50 outline-none transition"
                      />
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-fg mb-1.5">Merchant Order ID <span className="text-fg-muted">(optional)</span></label>
                      <input
                        type="text"
                        placeholder="e.g. ORD-1234"
                        value={merchantOrderId}
                        onChange={e => setMerchantOrderId(e.target.value)}
                        className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-fg placeholder-fg-muted focus:border-accent/50 outline-none transition"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={creating}
                      className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-bg font-semibold py-2.5 rounded-lg transition flex items-center justify-center gap-2"
                    >
                      {creating ? <><i className="fa-solid fa-spinner fa-spin"></i> Creating...</> : 'Generate Link'}
                    </button>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
