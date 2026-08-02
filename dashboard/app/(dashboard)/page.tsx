'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

type Period = '7d' | '30d' | '90d';

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
  gateways: Array<{
    pg_name: string;
    status: 'healthy' | 'degraded' | 'critical' | 'no_data';
    attempts_1h: number;
    success_rate_1h: number;
    avg_latency_ms_1h: number;
  }>;
  attention: {
    active_alerts: number;
    critical_alerts: number;
    failed_payments: number;
    expired_sessions: number;
    pending_subsidy_entries: number;
    imei_actions_required: number;
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
  recent_activity: Array<{
    type: 'payment' | 'order' | 'alert';
    id: string;
    status: string;
    amount?: number;
    occurred_at: string;
    destination: string;
  }>;
}

const PERIODS: Array<{ value: Period; label: string }> = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
];

function formatINR(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

function statusClass(status: string): string {
  if (status === 'healthy' || status === 'success' || status === 'paid') return 'bg-success/10 text-success';
  if (status === 'critical' || status === 'failed') return 'bg-danger/10 text-danger';
  if (status === 'degraded' || status === 'expired') return 'bg-accent/10 text-accent';
  return 'bg-info/10 text-info';
}

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>('30d');
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    apiFetch(`/api/dashboard/overview?period=${period}`)
      .then((data) => {
        if (active) setOverview(data as DashboardOverview);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [period]);

  if (loading && !overview) {
    return <div className="flex items-center justify-center h-64"><i className="fa-solid fa-spinner fa-spin text-accent text-2xl"></i></div>;
  }

  if (error || !overview) {
    return (
      <div className="bg-danger/10 border border-danger/20 rounded-xl p-6 text-center">
        <i className="fa-solid fa-circle-exclamation text-danger text-2xl mb-3"></i>
        <p className="text-danger font-medium">{error || 'Dashboard data is unavailable'}</p>
        <p className="text-fg-muted text-sm mt-2">Make sure the API server is running on port 3010</p>
      </div>
    );
  }

  const metrics = [
    { label: 'Gross payment volume', value: formatINR(overview.performance.gross_payment_volume), icon: 'fa-indian-rupee-sign', color: 'text-accent', bg: 'bg-accent/10' },
    { label: 'Paid orders', value: overview.performance.paid_orders.toLocaleString(), icon: 'fa-bag-shopping', color: 'text-success', bg: 'bg-success/10' },
    { label: 'Checkout conversion', value: `${overview.performance.session_to_paid_conversion_rate}%`, icon: 'fa-arrow-trend-up', color: 'text-info', bg: 'bg-info/10' },
    { label: 'Payment success rate', value: `${overview.performance.payment_attempt_success_rate}%`, icon: 'fa-circle-check', color: 'text-success', bg: 'bg-success/10' },
    { label: 'Average order value', value: formatINR(overview.performance.average_order_value), icon: 'fa-chart-simple', color: 'text-accent', bg: 'bg-accent/10' },
  ];

  const attentionItems = [
    { label: 'Critical gateway alerts', value: overview.attention.critical_alerts, href: '/pg-health', icon: 'fa-triangle-exclamation', tone: 'text-danger' },
    { label: 'Failed payment attempts', value: overview.attention.failed_payments, href: '/transactions', icon: 'fa-circle-xmark', tone: 'text-danger' },
    { label: 'Expired checkout sessions', value: overview.attention.expired_sessions, href: '/sessions', icon: 'fa-clock', tone: 'text-accent' },
    { label: 'IMEI actions required', value: overview.attention.imei_actions_required, href: '/subsidy', icon: 'fa-mobile-screen-button', tone: 'text-info' },
  ].filter((item) => item.value > 0);

  return (
    <div className="space-y-8 max-w-[1500px]">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-accent uppercase tracking-wider mb-2">Business performance</p>
          <h2 className="text-2xl font-bold text-fg">Your checkout, at a glance</h2>
          <p className="text-fg-muted text-sm mt-1">Revenue outcomes first. Operational exceptions when they need attention.</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value as Period)}
            className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-fg outline-none focus:border-accent"
            aria-label="Performance period"
          >
            {PERIODS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <Link href="/orders" className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-bg font-semibold px-4 py-2 rounded-lg transition text-sm">
            <i className="fa-solid fa-link text-xs"></i>
            Create payment link
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="bg-surface rounded-2xl border border-border p-5">
            <div className={`w-10 h-10 ${metric.bg} rounded-lg flex items-center justify-center mb-4`}>
              <i className={`fa-solid ${metric.icon} ${metric.color}`}></i>
            </div>
            <p className="text-fg-muted text-xs mb-1">{metric.label}</p>
            <p className="text-2xl font-bold text-fg tracking-tight">{metric.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="xl:col-span-2 bg-surface rounded-2xl border border-border p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-fg">Checkout funnel</h3>
              <p className="text-sm text-fg-muted mt-1">Where customer sessions progress or fall away.</p>
            </div>
            <Link href="/sessions" className="text-accent hover:text-accent-hover text-sm font-semibold">View sessions <i className="fa-solid fa-arrow-right text-xs ml-1"></i></Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-border">
            {[
              { label: 'Sessions', value: overview.funnel.sessions_created, tone: 'text-fg' },
              { label: 'Attempts', value: overview.funnel.payment_attempts, tone: 'text-info' },
              { label: 'Paid', value: overview.funnel.paid, tone: 'text-success' },
              { label: 'Failed', value: overview.funnel.failed, tone: overview.funnel.failed > 0 ? 'text-danger' : 'text-fg' },
              { label: 'Expired', value: overview.funnel.expired, tone: overview.funnel.expired > 0 ? 'text-accent' : 'text-fg' },
            ].map((stage) => (
              <div key={stage.label} className="px-4 py-2 first:pl-0 max-md:odd:border-b max-md:py-4">
                <p className="text-xs text-fg-muted">{stage.label}</p>
                <p className={`text-2xl font-bold mt-1 ${stage.tone}`}>{stage.value.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-surface rounded-2xl border border-border p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-lg font-bold text-fg">Needs attention</h3>
              <p className="text-sm text-fg-muted mt-1">Only items that can affect revenue.</p>
            </div>
            <span className={`w-2.5 h-2.5 rounded-full ${attentionItems.length > 0 ? 'bg-accent' : 'bg-success'}`}></span>
          </div>
          {attentionItems.length === 0 ? (
            <div className="flex items-center gap-3 py-5 text-success">
              <i className="fa-solid fa-circle-check text-xl"></i>
              <div><p className="font-semibold text-sm">All clear</p><p className="text-xs text-fg-muted mt-0.5">No checkout actions require attention.</p></div>
            </div>
          ) : (
            <div className="space-y-1">
              {attentionItems.map((item) => (
                <Link key={item.label} href={item.href} className="flex items-center gap-3 p-3 -mx-3 rounded-lg hover:bg-surface-2 transition">
                  <i className={`fa-solid ${item.icon} w-4 text-center ${item.tone}`}></i>
                  <span className="flex-1 text-sm text-fg-soft">{item.label}</span>
                  <span className="font-bold text-fg">{item.value}</span>
                  <i className="fa-solid fa-chevron-right text-[10px] text-fg-muted"></i>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="xl:col-span-2 bg-surface rounded-2xl border border-border p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-lg font-bold text-fg">Payment gateway health</h3>
              <p className="text-sm text-fg-muted mt-1">Live gateway performance over the last hour.</p>
            </div>
            <Link href="/pg-health" className="text-accent hover:text-accent-hover text-sm font-semibold">Open monitor <i className="fa-solid fa-arrow-right text-xs ml-1"></i></Link>
          </div>
          {overview.gateways.length === 0 ? (
            <p className="py-8 text-center text-sm text-fg-muted">No payment attempts in the last hour.</p>
          ) : (
            <div className="space-y-3">
              {overview.gateways.map((gateway) => (
                <div key={gateway.pg_name} className="flex items-center gap-4 py-3 border-b border-border last:border-0">
                  <div className="w-10 h-10 bg-surface-2 rounded-lg flex items-center justify-center"><i className="fa-solid fa-server text-fg-muted text-sm"></i></div>
                  <div className="flex-1"><p className="font-semibold text-fg capitalize">{gateway.pg_name}</p><p className="text-xs text-fg-muted mt-0.5">{gateway.attempts_1h} attempts · {gateway.avg_latency_ms_1h}ms average</p></div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusClass(gateway.status)}`}>{gateway.status}</span>
                  <div className="w-24 text-right"><p className="font-bold text-fg">{gateway.success_rate_1h}%</p><p className="text-[11px] text-fg-muted">success</p></div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-surface rounded-2xl border border-border p-6">
          <div className="flex items-center justify-between mb-5"><h3 className="text-lg font-bold text-fg">Commercial impact</h3><Link href="/analytics" className="text-accent text-sm font-semibold">Analytics</Link></div>
          <div className="space-y-4">
            <div className="flex justify-between items-baseline border-b border-border pb-4"><span className="text-sm text-fg-muted">Active offers</span><span className="text-xl font-bold text-fg">{overview.offers.active_offers}</span></div>
            <div className="flex justify-between items-baseline border-b border-border pb-4"><span className="text-sm text-fg-muted">Offer conversion</span><span className="text-xl font-bold text-success">{overview.offers.conversion_rate}%</span></div>
            <div className="flex justify-between items-baseline"><span className="text-sm text-fg-muted">Discounts granted</span><span className="text-xl font-bold text-fg">{formatINR(overview.offers.discounts_granted)}</span></div>
          </div>
          <Link href="/create" className="flex justify-center items-center gap-2 mt-6 py-2.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-sm font-semibold text-fg transition"><i className="fa-solid fa-plus text-xs"></i>Create offer</Link>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="xl:col-span-2 bg-surface rounded-2xl border border-border overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b border-border"><div><h3 className="text-lg font-bold text-fg">Recent payment activity</h3><p className="text-sm text-fg-muted mt-1">The latest outcomes from your checkout.</p></div><Link href="/transactions" className="text-accent text-sm font-semibold">View all</Link></div>
          {overview.recent_activity.length === 0 ? <p className="p-8 text-center text-sm text-fg-muted">No payment activity in this period.</p> : (
            <div className="divide-y divide-border">
              {overview.recent_activity.map((activity) => (
                <Link key={activity.id} href={activity.destination} className="flex items-center gap-4 px-6 py-4 hover:bg-surface-2 transition">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center ${statusClass(activity.status)}`}><i className={`fa-solid ${activity.status === 'success' ? 'fa-check' : activity.status === 'failed' ? 'fa-xmark' : 'fa-clock'} text-xs`}></i></div>
                  <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-fg capitalize">Payment {activity.status}</p><p className="text-xs text-fg-muted mt-0.5 font-mono truncate">{activity.id}</p></div>
                  <div className="text-right"><p className="text-sm font-semibold text-fg">{activity.amount !== undefined ? formatINR(activity.amount) : '—'}</p><p className="text-xs text-fg-muted mt-0.5">{new Date(activity.occurred_at).toLocaleDateString('en-IN')}</p></div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="bg-surface rounded-2xl border border-border p-6">
          <div className="flex items-center justify-between mb-5"><div><h3 className="text-lg font-bold text-fg">Subsidy exposure</h3><p className="text-sm text-fg-muted mt-1">Outstanding brand settlements.</p></div><i className="fa-solid fa-handshake text-accent"></i></div>
          <p className="text-3xl font-bold text-fg">{formatINR(overview.finance.pending_subsidy_amount)}</p>
          <p className="text-sm text-fg-muted mt-1">across {overview.finance.pending_subsidy_entries} open entries</p>
          <div className="grid grid-cols-2 gap-3 mt-6 pt-5 border-t border-border"><div><p className="text-xl font-bold text-info">{overview.finance.brands_with_open_subsidy}</p><p className="text-xs text-fg-muted mt-1">Brands</p></div><div><p className="text-xl font-bold text-accent">{overview.attention.imei_actions_required}</p><p className="text-xs text-fg-muted mt-1">IMEI actions</p></div></div>
          <Link href="/subsidy" className="flex justify-center items-center mt-6 py-2.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-sm font-semibold text-fg transition">Open subsidy ledger</Link>
        </section>
      </div>
    </div>
  );
}
