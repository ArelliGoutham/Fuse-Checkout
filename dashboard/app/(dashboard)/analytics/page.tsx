'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type Period = '7d' | '30d' | '90d';
type Tab = 'business' | 'checkout' | 'payments' | 'offers' | 'settlement';

interface DashboardOverview {
  performance: {
    gross_payment_volume: number;
    paid_orders: number;
    average_order_value: number;
    checkout_sessions: number;
    session_to_paid_conversion_rate: number;
    payment_attempt_success_rate: number;
  };
  funnel: {
    sessions_created: number;
    payment_attempts: number;
    paid: number;
    failed: number;
    expired: number;
  };
  offers: {
    active_offers: number;
    redemptions: number;
    paid_redemptions: number;
    conversion_rate: number;
    discounts_granted: number;
  };
  finance: {
    pending_subsidy_amount: number;
    pending_subsidy_entries: number;
    brands_with_open_subsidy: number;
  };
}

interface TransactionAnalytics {
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

interface OfferAnalytics {
  offer_id: string;
  redemptions: number;
  conversions: number;
  revenue: number;
}

interface OfferOverview {
  total_redemptions: number;
  conversions: number;
  abandoned: number;
  conversion_rate: number;
  total_discount_given: number;
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

interface CampaignsResponse {
  campaigns: Array<{ _id: string; status: string; emi_type: string; requires_imei: boolean }>;
}

const PERIODS: Array<{ value: Period; label: string }> = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
];

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'business', label: 'Business performance', icon: 'fa-chart-line' },
  { id: 'checkout', label: 'Checkout funnel', icon: 'fa-filter' },
  { id: 'payments', label: 'Payments & gateways', icon: 'fa-credit-card' },
  { id: 'offers', label: 'Offers', icon: 'fa-tags' },
  { id: 'settlement', label: 'Settlement & EMI', icon: 'fa-building-columns' },
];

function formatINR(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

function dateRange(period: Period): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - Number.parseInt(period, 10) * 24 * 60 * 60 * 1000);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function MetricCard({ label, value, icon, tone = 'accent' }: { label: string; value: string; icon: string; tone?: 'accent' | 'success' | 'info' | 'danger' }) {
  const tones = {
    accent: 'bg-accent/10 text-accent',
    success: 'bg-success/10 text-success',
    info: 'bg-info/10 text-info',
    danger: 'bg-danger/10 text-danger',
  };

  return (
    <div className="bg-surface rounded-2xl border border-border p-5">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-5 ${tones[tone]}`}>
        <i className={`fa-solid ${icon}`}></i>
      </div>
      <p className="text-fg-muted text-xs font-semibold uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-fg">{value}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="bg-surface border border-dashed border-border rounded-xl p-8 text-center text-sm text-fg-muted">{message}</div>;
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>('30d');
  const [activeTab, setActiveTab] = useState<Tab>('business');
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [transactionAnalytics, setTransactionAnalytics] = useState<TransactionAnalytics | null>(null);
  const [offerOverview, setOfferOverview] = useState<OfferOverview | null>(null);
  const [offerStats, setOfferStats] = useState<OfferAnalytics[]>([]);
  const [reconciliation, setReconciliation] = useState<Reconciliation | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignsResponse['campaigns']>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const range = dateRange(period);
    let active = true;
    setLoading(true);
    setError(null);

    Promise.all([
      apiFetch(`/api/dashboard/overview?period=${period}`),
      apiFetch(`/api/transactions/analytics?from=${range.from}&to=${range.to}`),
      apiFetch(`/api/analytics/overview?period=${period}`),
      apiFetch(`/api/analytics/offers?period=${period}`),
      apiFetch('/api/subsidy/reconciliation'),
      apiFetch('/api/admin/emi-campaigns'),
    ])
      .then(([dashboardData, transactionData, offerData, offersData, reconciliationData, campaignsData]) => {
        if (!active) return;
        setOverview(dashboardData as DashboardOverview);
        setTransactionAnalytics(transactionData as TransactionAnalytics);
        setOfferOverview(offerData as OfferOverview);
        setOfferStats((offersData as { offers?: OfferAnalytics[] }).offers || []);
        setReconciliation(reconciliationData as Reconciliation);
        setCampaigns((campaignsData as CampaignsResponse).campaigns || []);
      })
      .catch((requestError) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Failed to load analytics');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [period]);

  if (loading && !overview) {
    return <div className="flex justify-center py-12"><i className="fa-solid fa-spinner fa-spin text-accent text-2xl"></i></div>;
  }

  if (error || !overview) {
    return <div className="bg-danger/10 border border-danger/20 rounded-xl p-6 text-danger text-center">{error || 'Analytics are unavailable'}</div>;
  }

  const performance = overview.performance;
  const funnel = overview.funnel;
  const paidRate = funnel.sessions_created > 0 ? Math.round((funnel.paid / funnel.sessions_created) * 100) : 0;
  const activeCampaigns = campaigns.filter((campaign) => campaign.status === 'active');

  return (
    <div className="space-y-7 max-w-[1500px]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold text-accent uppercase tracking-wider mb-2">Performance intelligence</p>
          <h2 className="text-2xl font-bold text-fg">Analytics that follow the payment</h2>
          <p className="text-fg-muted text-sm mt-1">Understand commercial outcomes, checkout behaviour, payment quality, and offer efficiency.</p>
        </div>
        <select
          value={period}
          onChange={(event) => setPeriod(event.target.value as Period)}
          className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-fg outline-none focus:border-accent"
          aria-label="Analytics period"
        >
          {PERIODS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>

      <div className="flex gap-2 overflow-x-auto border-b border-border pb-px">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 flex items-center gap-2 px-3 py-3 text-sm font-semibold border-b-2 transition ${activeTab === tab.id ? 'border-accent text-accent' : 'border-transparent text-fg-muted hover:text-fg'}`}
          >
            <i className={`fa-solid ${tab.icon} text-xs`}></i>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'business' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <MetricCard label="Gross payment volume" value={formatINR(performance.gross_payment_volume)} icon="fa-indian-rupee-sign" />
            <MetricCard label="Paid orders" value={performance.paid_orders.toLocaleString()} icon="fa-bag-shopping" tone="success" />
            <MetricCard label="Average order value" value={formatINR(performance.average_order_value)} icon="fa-chart-simple" tone="info" />
            <MetricCard label="Checkout conversion" value={`${performance.session_to_paid_conversion_rate}%`} icon="fa-arrow-trend-up" tone="success" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-5">
            <section className="bg-surface border border-border rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-fg">Payment quality</h3>
                  <p className="text-sm text-fg-muted mt-1">A payment attempt becomes a completed order.</p>
                </div>
                <Link href="/transactions" className="text-sm font-semibold text-accent hover:opacity-75">View transactions</Link>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><p className="text-2xl font-bold text-fg">{performance.payment_attempt_success_rate}%</p><p className="text-xs text-fg-muted mt-1">Payment success</p></div>
                <div><p className="text-2xl font-bold text-fg">{transactionAnalytics?.avg_latency_ms ?? 0}ms</p><p className="text-xs text-fg-muted mt-1">Average latency</p></div>
                <div><p className="text-2xl font-bold text-fg">{funnel.failed.toLocaleString()}</p><p className="text-xs text-fg-muted mt-1">Failed attempts</p></div>
              </div>
            </section>

            <section className="bg-surface border border-border rounded-2xl p-6">
              <h3 className="text-lg font-bold text-fg">Commercial impact</h3>
              <p className="text-sm text-fg-muted mt-1 mb-5">Offers are measured as a business lever, not the full business story.</p>
              <div className="space-y-3">
                <div className="flex justify-between text-sm"><span className="text-fg-muted">Active offers</span><span className="font-semibold text-fg">{overview.offers.active_offers}</span></div>
                <div className="flex justify-between text-sm"><span className="text-fg-muted">Offer conversion</span><span className="font-semibold text-success">{overview.offers.conversion_rate}%</span></div>
                <div className="flex justify-between text-sm"><span className="text-fg-muted">Discounts granted</span><span className="font-semibold text-fg">{formatINR(overview.offers.discounts_granted)}</span></div>
              </div>
            </section>
          </div>
        </div>
      )}

      {activeTab === 'checkout' && (
        <div className="space-y-5">
          <section className="bg-surface border border-border rounded-2xl p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-8">
              <div><h3 className="text-lg font-bold text-fg">Checkout funnel</h3><p className="text-sm text-fg-muted mt-1">Conversion from a created checkout session to a paid order.</p></div>
              <Link href="/sessions" className="text-sm font-semibold text-accent hover:opacity-75">Inspect sessions</Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: 'Sessions created', value: funnel.sessions_created, note: 'Entry point', tone: 'bg-info' },
                { label: 'Payment attempts', value: funnel.payment_attempts, note: `${funnel.sessions_created > 0 ? Math.round((funnel.payment_attempts / funnel.sessions_created) * 100) : 0}% reached payment`, tone: 'bg-accent' },
                { label: 'Paid orders', value: funnel.paid, note: `${paidRate}% session-to-paid`, tone: 'bg-success' },
              ].map((step, index) => (
                <div key={step.label} className="relative bg-surface-2 border border-border rounded-xl p-5">
                  {index < 2 && <i className="fa-solid fa-arrow-right absolute -right-3 top-1/2 -translate-y-1/2 hidden md:block text-fg-muted z-10"></i>}
                  <div className={`w-2 h-2 rounded-full ${step.tone} mb-4`}></div>
                  <p className="text-3xl font-bold text-fg">{step.value.toLocaleString()}</p>
                  <p className="text-sm font-semibold text-fg mt-2">{step.label}</p>
                  <p className="text-xs text-fg-muted mt-1">{step.note}</p>
                </div>
              ))}
            </div>
          </section>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <MetricCard label="Failed payment attempts" value={funnel.failed.toLocaleString()} icon="fa-circle-xmark" tone="danger" />
            <MetricCard label="Expired sessions" value={funnel.expired.toLocaleString()} icon="fa-clock" tone="accent" />
          </div>
        </div>
      )}

      {activeTab === 'payments' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <MetricCard label="Payment attempts" value={(transactionAnalytics?.total_attempts ?? 0).toLocaleString()} icon="fa-rotate" tone="info" />
            <MetricCard label="Payment success" value={`${transactionAnalytics?.success_rate ?? 0}%`} icon="fa-circle-check" tone="success" />
            <MetricCard label="Successful volume" value={formatINR(transactionAnalytics?.total_volume ?? 0)} icon="fa-indian-rupee-sign" />
            <MetricCard label="Average latency" value={`${transactionAnalytics?.avg_latency_ms ?? 0}ms`} icon="fa-stopwatch" tone="info" />
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <section className="bg-surface border border-border rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5"><h3 className="text-lg font-bold text-fg">Gateway performance</h3><Link href="/pg-health" className="text-sm font-semibold text-accent hover:opacity-75">PG health</Link></div>
              {!transactionAnalytics?.pg_breakdown.length ? <EmptyState message="No payment attempts in this period." /> : <div className="space-y-4">{transactionAnalytics.pg_breakdown.map((gateway) => (
                <div key={gateway.pg_name}>
                  <div className="flex justify-between items-baseline text-sm mb-2"><span className="font-semibold text-fg capitalize">{gateway.pg_name}</span><span className="text-success font-semibold">{gateway.success_rate}%</span></div>
                  <div className="h-2 bg-surface-2 rounded-full overflow-hidden"><div className="h-full bg-success rounded-full" style={{ width: `${Math.min(gateway.success_rate, 100)}%` }}></div></div>
                  <div className="flex justify-between text-xs text-fg-muted mt-2"><span>{gateway.attempts} attempts</span><span>{gateway.avg_latency_ms}ms latency</span></div>
                </div>
              ))}</div>}
            </section>
            <section className="bg-surface border border-border rounded-2xl p-6">
              <h3 className="text-lg font-bold text-fg mb-5">Payment methods</h3>
              {!transactionAnalytics?.payment_methods.length ? <EmptyState message="No payment methods recorded in this period." /> : <div className="space-y-3">{transactionAnalytics.payment_methods.map((method) => (
                <div key={method.method} className="flex items-center justify-between bg-surface-2 rounded-xl px-4 py-3"><div><p className="text-sm font-semibold text-fg capitalize">{method.method || 'Unknown'}</p><p className="text-xs text-fg-muted mt-1">{method.count} attempts</p></div><span className="font-bold text-success">{method.success_rate}%</span></div>
              ))}</div>}
            </section>
          </div>
        </div>
      )}

      {activeTab === 'offers' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <MetricCard label="Offer redemptions" value={(offerOverview?.total_redemptions ?? 0).toLocaleString()} icon="fa-tags" />
            <MetricCard label="Offer conversions" value={(offerOverview?.conversions ?? 0).toLocaleString()} icon="fa-check" tone="success" />
            <MetricCard label="Offer conversion" value={`${Math.round(offerOverview?.conversion_rate ?? 0)}%`} icon="fa-arrow-trend-up" tone="success" />
            <MetricCard label="Discounts granted" value={formatINR(offerOverview?.total_discount_given ?? 0)} icon="fa-indian-rupee-sign" tone="info" />
          </div>
          <section className="bg-surface border border-border rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-border flex items-center justify-between"><div><h3 className="text-lg font-bold text-fg">Per-offer performance</h3><p className="text-sm text-fg-muted mt-1">Use this to compare offer adoption and paid conversion.</p></div><Link href="/create" className="text-sm font-semibold text-accent hover:opacity-75">Create offer</Link></div>
            {!offerStats.length ? <div className="p-6"><EmptyState message="No offer redemptions yet." /></div> : <div className="divide-y divide-border">{offerStats.map((offer) => (
              <div key={offer.offer_id} className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 hover:bg-surface-2 transition"><div className="col-span-2 sm:col-span-1"><p className="font-semibold text-fg truncate">{offer.offer_id}</p><p className="text-xs text-fg-muted mt-1">Offer identifier</p></div><div><p className="text-xs text-fg-muted">Redemptions</p><p className="font-bold text-fg mt-1">{offer.redemptions}</p></div><div><p className="text-xs text-fg-muted">Paid conversions</p><p className="font-bold text-success mt-1">{offer.conversions}</p></div><div><p className="text-xs text-fg-muted">Discounts granted</p><p className="font-bold text-fg mt-1">{formatINR(offer.revenue || 0)}</p></div></div>
            ))}</div>}
          </section>
        </div>
      )}

      {activeTab === 'settlement' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <MetricCard label="Subsidy exposure" value={formatINR(overview.finance.pending_subsidy_amount)} icon="fa-indian-rupee-sign" tone="info" />
            <MetricCard label="Open subsidy entries" value={overview.finance.pending_subsidy_entries.toLocaleString()} icon="fa-receipt" tone="accent" />
            <MetricCard label="Brands with exposure" value={overview.finance.brands_with_open_subsidy.toLocaleString()} icon="fa-building" tone="info" />
            <MetricCard label="Active EMI campaigns" value={activeCampaigns.length.toLocaleString()} icon="fa-calendar-check" tone="success" />
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-5">
            <section className="bg-surface border border-border rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5"><div><h3 className="text-lg font-bold text-fg">Subsidy reconciliation</h3><p className="text-sm text-fg-muted mt-1">Current settlement position by brand.</p></div><Link href="/subsidy" className="text-sm font-semibold text-accent hover:opacity-75">Open ledger</Link></div>
              {!reconciliation?.by_brand.length ? <EmptyState message="No subsidy ledger entries yet." /> : <div className="space-y-3">{reconciliation.by_brand.map((brand) => (
                <div key={brand.brand} className="grid grid-cols-2 sm:grid-cols-5 gap-3 rounded-xl bg-surface-2 p-4"><div className="col-span-2 sm:col-span-1"><p className="font-semibold text-fg">{brand.brand || 'Unassigned'}</p><p className="text-xs text-fg-muted mt-1">{formatINR(brand.total_amount)}</p></div><div><p className="text-xs text-fg-muted">Pending</p><p className="font-bold text-info mt-1">{brand.pending}</p></div><div><p className="text-xs text-fg-muted">IMEI blocked</p><p className="font-bold text-accent mt-1">{brand.imei_blocked}</p></div><div><p className="text-xs text-fg-muted">Settled</p><p className="font-bold text-success mt-1">{brand.settled}</p></div><div><p className="text-xs text-fg-muted">Paid</p><p className="font-bold text-success mt-1">{brand.paid}</p></div></div>
              ))}</div>}
            </section>
            <section className="bg-surface border border-border rounded-2xl p-6">
              <h3 className="text-lg font-bold text-fg">EMI programme health</h3>
              <p className="text-sm text-fg-muted mt-1 mb-5">Campaign configuration that shapes financing eligibility.</p>
              <div className="space-y-4"><div className="flex justify-between text-sm"><span className="text-fg-muted">Active campaigns</span><span className="font-semibold text-fg">{activeCampaigns.length}</span></div><div className="flex justify-between text-sm"><span className="text-fg-muted">No-cost EMI campaigns</span><span className="font-semibold text-fg">{activeCampaigns.filter((campaign) => campaign.emi_type === 'no_cost').length}</span></div><div className="flex justify-between text-sm"><span className="text-fg-muted">Requires IMEI</span><span className="font-semibold text-fg">{activeCampaigns.filter((campaign) => campaign.requires_imei).length}</span></div></div>
              <Link href="/emi-campaigns" className="mt-6 inline-flex text-sm font-semibold text-accent hover:opacity-75">Manage EMI campaigns <i className="fa-solid fa-arrow-right ml-2 mt-0.5 text-xs"></i></Link>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
