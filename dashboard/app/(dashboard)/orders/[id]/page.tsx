'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';

interface CartItem {
  sku_id: string;
  name: string;
  price: number;
  qty: number;
}

interface Customer {
  name: string | null;
  email: string | null;
  phone: string | null;
  address: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
  } | null;
}

interface AppliedOffer {
  offer_id: string;
  type: string;
  discount_amount: number;
}

interface EmiDetail {
  bank: string;
  tenure: number;
  emi_amount: number;
  interest: number;
  subsidy: number;
}

interface OrderDetail {
  _id: string;
  merchant_order_id: string | null;
  pg_name: string;
  pg_order_id: string | null;
  pg_payment_id: string | null;
  final_amount: number;
  order_status: string;
  payment_method: string;
  refund_id: string | null;
  created_at: string;
  cart_items: CartItem[];
  customer: Customer | null;
  applied_offers: AppliedOffer[];
  emi_details: EmiDetail | null;
  shipping_address?: Customer['address'] | null;
}

interface RefundResponse {
  refund_id: string;
}

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Refund modal state
  const [showRefund, setShowRefund] = useState(false);
  const [refundType, setRefundType] = useState<'full' | 'partial'>('full');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refunding, setRefunding] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);
  const [refundSuccess, setRefundSuccess] = useState<{ refund_id: string } | null>(null);

  const fetchOrder = () => {
    setLoading(true);
    apiFetch(`/api/orders/${id}`)
      .then(data => setOrder(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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

  const formatAddress = (addr: Customer['address']) => {
    if (!addr) return '—';
    const parts = [addr.line1, addr.line2, addr.city, addr.state, addr.pincode, addr.country].filter(Boolean);
    return parts.length ? parts.join(', ') : '—';
  };

  const handleRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    setRefundError(null);

    const body: Record<string, unknown> = { reason: refundReason || undefined };
    if (refundType === 'partial') {
      const amt = parseFloat(refundAmount);
      if (isNaN(amt) || amt <= 0) {
        setRefundError('Enter a valid refund amount');
        return;
      }
      body.amount = amt;
    }

    setRefunding(true);
    try {
      const data = await apiFetch(`/api/orders/${id}/refund`, {
        method: 'POST',
        body: JSON.stringify(body),
      }) as RefundResponse;
      setRefundSuccess({ refund_id: data.refund_id });
    } catch (err) {
      setRefundError(err instanceof Error ? err.message : 'Refund failed');
    } finally {
      setRefunding(false);
    }
  };

  const closeRefundModal = () => {
    setShowRefund(false);
    setRefundType('full');
    setRefundAmount('');
    setRefundReason('');
    setRefundError(null);
    setRefundSuccess(null);
  };

  if (loading) {
    return <div className="flex justify-center py-12"><i className="fa-solid fa-spinner fa-spin text-accent text-2xl"></i></div>;
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link href="/orders" className="text-fg-soft hover:text-accent transition flex items-center gap-2 text-sm">
          <i className="fa-solid fa-arrow-left"></i> Back to Orders
        </Link>
        <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 text-danger">{error}</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="space-y-4">
        <Link href="/orders" className="text-fg-soft hover:text-accent transition flex items-center gap-2 text-sm">
          <i className="fa-solid fa-arrow-left"></i> Back to Orders
        </Link>
        <div className="text-fg-muted text-center py-12">Order not found</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link href="/orders" className="text-fg-soft hover:text-accent transition flex items-center gap-2 text-sm">
        <i className="fa-solid fa-arrow-left"></i> Back to Orders
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-fg font-mono">{order._id}</h2>
          <p className="text-fg-muted text-sm mt-1">
            {order.merchant_order_id ? `Ref: ${order.merchant_order_id}` : 'No merchant order ID'}
          </p>
        </div>
        {order.order_status === 'paid' && (
          <button
            onClick={() => setShowRefund(true)}
            className="flex items-center gap-2 bg-danger/10 hover:bg-danger/20 text-danger font-semibold px-4 py-2 rounded-lg transition"
          >
            <i className="fa-solid fa-rotate-left text-xs"></i>
            Refund
          </button>
        )}
      </div>

      {/* 1. Order Summary */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <h3 className="text-sm font-semibold text-fg mb-4 flex items-center gap-2">
          <i className="fa-solid fa-clipboard-list text-accent"></i> Order Summary
        </h3>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <div className="text-xs text-fg-muted mb-1">Status</div>
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${statusBadge(order.order_status)}`}>
              {order.order_status}
            </span>
          </div>
          <div>
            <div className="text-xs text-fg-muted mb-1">Amount</div>
            <div className="text-sm font-semibold text-fg">{formatINR(order.final_amount)}</div>
          </div>
          <div>
            <div className="text-xs text-fg-muted mb-1">Date</div>
            <div className="text-sm text-fg-soft">{new Date(order.created_at).toLocaleString('en-IN')}</div>
          </div>
          <div>
            <div className="text-xs text-fg-muted mb-1">Merchant Order ID</div>
            <div className="text-sm text-fg-soft">{order.merchant_order_id || '—'}</div>
          </div>
        </div>
      </div>

      {/* 2. Cart Items */}
      {order.cart_items && order.cart_items.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-6">
          <h3 className="text-sm font-semibold text-fg mb-4 flex items-center gap-2">
            <i className="fa-solid fa-cart-shopping text-accent"></i> Cart Items
          </h3>
          <div className="overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-2 py-2 text-xs font-semibold text-fg-muted uppercase">Name</th>
                  <th className="text-left px-2 py-2 text-xs font-semibold text-fg-muted uppercase">SKU</th>
                  <th className="text-right px-2 py-2 text-xs font-semibold text-fg-muted uppercase">Price</th>
                  <th className="text-center px-2 py-2 text-xs font-semibold text-fg-muted uppercase">Qty</th>
                  <th className="text-right px-2 py-2 text-xs font-semibold text-fg-muted uppercase">Total</th>
                </tr>
              </thead>
              <tbody>
                {order.cart_items.map((item, i) => (
                  <tr key={i} className="border-b border-border-light last:border-0">
                    <td className="px-2 py-3 text-sm text-fg">{item.name}</td>
                    <td className="px-2 py-3 text-sm text-fg-soft font-mono">{item.sku_id}</td>
                    <td className="px-2 py-3 text-sm text-fg-soft text-right">{formatINR(item.price)}</td>
                    <td className="px-2 py-3 text-sm text-fg-soft text-center">{item.qty}</td>
                    <td className="px-2 py-3 text-sm text-fg font-semibold text-right">{formatINR(item.price * item.qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. Customer */}
      {order.customer && (
        <div className="bg-surface border border-border rounded-xl p-6">
          <h3 className="text-sm font-semibold text-fg mb-4 flex items-center gap-2">
            <i className="fa-solid fa-user text-accent"></i> Customer
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-fg-muted mb-1">Name</div>
              <div className="text-sm text-fg">{order.customer.name || '—'}</div>
            </div>
            <div>
              <div className="text-xs text-fg-muted mb-1">Email</div>
              <div className="text-sm text-fg">{order.customer.email || '—'}</div>
            </div>
            <div>
              <div className="text-xs text-fg-muted mb-1">Phone</div>
              <div className="text-sm text-fg">{order.customer.phone || '—'}</div>
            </div>
            <div>
              <div className="text-xs text-fg-muted mb-1">Address</div>
              <div className="text-sm text-fg-soft">{formatAddress(order.customer.address)}</div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Payment */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <h3 className="text-sm font-semibold text-fg mb-4 flex items-center gap-2">
          <i className="fa-solid fa-credit-card text-accent"></i> Payment
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-fg-muted mb-1">PG Name</div>
            <div className="text-sm text-fg capitalize">{order.pg_name}</div>
          </div>
          <div>
            <div className="text-xs text-fg-muted mb-1">PG Order ID</div>
            <div className="text-sm text-fg-soft font-mono">{order.pg_order_id || '—'}</div>
          </div>
          <div>
            <div className="text-xs text-fg-muted mb-1">PG Payment ID</div>
            <div className="text-sm text-fg-soft font-mono">{order.pg_payment_id || '—'}</div>
          </div>
          <div>
            <div className="text-xs text-fg-muted mb-1">Payment Method</div>
            <div className="text-sm text-fg-soft">{order.payment_method || '—'}</div>
          </div>
          {order.refund_id && (
            <div>
              <div className="text-xs text-fg-muted mb-1">Refund ID</div>
              <div className="text-sm text-fg-soft font-mono">{order.refund_id}</div>
            </div>
          )}
        </div>
      </div>

      {/* 5. Applied Offers */}
      {order.applied_offers && order.applied_offers.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-6">
          <h3 className="text-sm font-semibold text-fg mb-4 flex items-center gap-2">
            <i className="fa-solid fa-tags text-accent"></i> Applied Offers
          </h3>
          <div className="overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-2 py-2 text-xs font-semibold text-fg-muted uppercase">Offer ID</th>
                  <th className="text-left px-2 py-2 text-xs font-semibold text-fg-muted uppercase">Type</th>
                  <th className="text-right px-2 py-2 text-xs font-semibold text-fg-muted uppercase">Discount Amount</th>
                </tr>
              </thead>
              <tbody>
                {order.applied_offers.map((offer, i) => (
                  <tr key={i} className="border-b border-border-light last:border-0">
                    <td className="px-2 py-3 text-sm text-fg font-mono">{offer.offer_id}</td>
                    <td className="px-2 py-3 text-sm text-fg-soft capitalize">{offer.type}</td>
                    <td className="px-2 py-3 text-sm text-fg font-semibold text-right text-danger">{formatINR(offer.discount_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. EMI Details */}
      {order.emi_details && (
        <div className="bg-surface border border-border rounded-xl p-6">
          <h3 className="text-sm font-semibold text-fg mb-4 flex items-center gap-2">
            <i className="fa-solid fa-calculator text-accent"></i> EMI Details
          </h3>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-fg-muted mb-1">Bank</div>
              <div className="text-sm text-fg">{order.emi_details.bank}</div>
            </div>
            <div>
              <div className="text-xs text-fg-muted mb-1">Tenure</div>
              <div className="text-sm text-fg-soft">{order.emi_details.tenure} months</div>
            </div>
            <div>
              <div className="text-xs text-fg-muted mb-1">EMI Amount</div>
              <div className="text-sm text-fg font-semibold">{formatINR(order.emi_details.emi_amount)}</div>
            </div>
            <div>
              <div className="text-xs text-fg-muted mb-1">Interest</div>
              <div className="text-sm text-fg-soft">{formatINR(order.emi_details.interest)}</div>
            </div>
            <div>
              <div className="text-xs text-fg-muted mb-1">Subsidy</div>
              <div className="text-sm text-fg-soft">{formatINR(order.emi_details.subsidy)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {showRefund && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={closeRefundModal}>
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-fg">Refund Order</h3>
              <button onClick={closeRefundModal} className="text-fg-muted hover:text-fg transition" disabled={refunding}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {refundSuccess ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-success">
                  <i className="fa-solid fa-circle-check"></i>
                  <span className="font-semibold">Refund initiated successfully!</span>
                </div>
                <div>
                  <div className="text-xs text-fg-muted mb-1">Refund ID</div>
                  <div className="text-sm text-fg font-mono bg-surface-2 border border-border rounded-lg px-3 py-2">{refundSuccess.refund_id}</div>
                </div>
                <button
                  onClick={() => { closeRefundModal(); fetchOrder(); }}
                  className="w-full bg-accent hover:bg-accent-hover text-bg font-semibold py-2 rounded-lg transition"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleRefund}>
                {refundError && (
                  <div className="bg-danger/10 border border-danger/20 rounded-lg p-3 text-danger text-sm mb-4">
                    <i className="fa-solid fa-circle-exclamation mr-2"></i>{refundError}
                  </div>
                )}

                {/* Refund type toggle */}
                <div className="flex gap-2 mb-4 p-1 bg-surface-2 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setRefundType('full')}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${refundType === 'full' ? 'bg-accent text-bg' : 'text-fg-soft hover:text-fg'}`}
                  >
                    Full Refund
                  </button>
                  <button
                    type="button"
                    onClick={() => setRefundType('partial')}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${refundType === 'partial' ? 'bg-accent text-bg' : 'text-fg-soft hover:text-fg'}`}
                  >
                    Partial
                  </button>
                </div>

                {refundType === 'partial' && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-fg mb-1.5">Refund Amount (₹)</label>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      max={order.final_amount}
                      placeholder={`Max ${order.final_amount}`}
                      value={refundAmount}
                      onChange={e => setRefundAmount(e.target.value)}
                      className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-fg placeholder-fg-muted focus:border-accent/50 outline-none transition"
                    />
                  </div>
                )}

                <div className="mb-4">
                  <label className="block text-sm font-medium text-fg mb-1.5">Reason <span className="text-fg-muted">(optional)</span></label>
                  <textarea
                    placeholder="Customer requested cancellation..."
                    value={refundReason}
                    onChange={e => setRefundReason(e.target.value)}
                    rows={3}
                    className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-fg placeholder-fg-muted focus:border-accent/50 outline-none transition resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={refunding}
                  className="w-full bg-danger hover:bg-danger/90 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition flex items-center justify-center gap-2"
                >
                  {refunding ? <><i className="fa-solid fa-spinner fa-spin"></i> Processing...</> : `Refund ${refundType === 'full' ? formatINR(order.final_amount) : ''}`}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
