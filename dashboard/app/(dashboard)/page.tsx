'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type Period = '7d' | '30d' | '90d';

interface DashboardOverview {
  performance: {
    gross_payment_volume: number;
    paid_orders: number;
    average_order_value: number;
    payment_attempt_success_rate: number;
  };
  attention: {
    critical_alerts: number;
    failed_payments: number;
    expired_sessions: number;
    imei_actions_required: number;
  };
  daily_gmv: Array<{
    date: string;
    gross_payment_volume: number;
    paid_orders: number;
  }>;
  payment_methods: Array<{
    payment_method: string;
    successful_payments: number;
    payment_volume: number;
  }>;
  payment_gateways: Array<{
    pg_name: string;
    successful_payments: number;
    payment_volume: number;
  }>;
  recent_activity: Array<{
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
  if (status === 'success' || status === 'paid') return 'bg-success/10 text-success';
  if (status === 'failed') return 'bg-danger/10 text-danger';
  return 'bg-info/10 text-info';
}

function dayLabel(date: string): string {
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
}

function changeLabel(current: number, previous: number): { label: string; tone: string } {
  if (previous === 0 && current === 0) return { label: 'No change from yesterday', tone: 'text-fg-muted' };
  if (previous === 0) return { label: 'First payment activity today', tone: 'text-success' };
  const change = Math.round(((current - previous) / previous) * 100);
  return {
    label: `${change >= 0 ? '+' : ''}${change}% vs yesterday`,
    tone: change >= 0 ? 'text-success' : 'text-danger',
  };
}

function MetricCard({ label, value, note, icon, tone = 'accent' }: { label: string; value: string; note: string; icon: string; tone?: 'accent' | 'success' | 'info' | 'danger' }) {
  const tones = {
    accent: 'bg-accent/10 text-accent',
    success: 'bg-success/10 text-success',
    info: 'bg-info/10 text-info',
    danger: 'bg-danger/10 text-danger',
  };

  return (
    <div className="bg-surface rounded-2xl border border-border p-5">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-5 ${tones[tone]}`}><i className={`fa-solid ${icon}`}></i></div>
      <p className="text-fg-muted text-xs font-semibold uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-fg tracking-tight">{value}</p>
      <p className="text-xs text-fg-muted mt-2">{note}</p>
    </div>
  );
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
      .catch((requestError) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Failed to load dashboard data');
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

  const dailyGMV = overview.daily_gmv;
  const today = dailyGMV[dailyGMV.length - 1] || { date: new Date().toISOString().slice(0, 10), gross_payment_volume: 0, paid_orders: 0 };
  const yesterday = dailyGMV[dailyGMV.length - 2] || { gross_payment_volume: 0, paid_orders: 0 };
  const gmvChange = changeLabel(today.gross_payment_volume, yesterday.gross_payment_volume);
  const orderChange = changeLabel(today.paid_orders, yesterday.paid_orders);
  const maxGMV = Math.max(...dailyGMV.map((day) => day.gross_payment_volume), 1);
  const activeGMVDays = dailyGMV.filter((day) => day.gross_payment_volume > 0);
  const chartWidth = 880;
  const chartHeight = 190;
  const chartBaseline = 164;
  const chartPoints = dailyGMV.map((day, index) => ({
    ...day,
    x: 28 + (index / Math.max(dailyGMV.length - 1, 1)) * (chartWidth - 56),
    y: chartBaseline - (day.gross_payment_volume / maxGMV) * 124,
  }));
  const linePath = chartPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const areaPath = chartPoints.length > 0
    ? `${linePath} L ${chartPoints[chartPoints.length - 1].x} ${chartBaseline} L ${chartPoints[0].x} ${chartBaseline} Z`
    : '';
  const paymentVolume = overview.payment_methods.reduce((total, method) => total + method.payment_volume, 0);
  const attentionItems = [
    { label: 'Critical gateway alerts', value: overview.attention.critical_alerts, href: '/pg-health', icon: 'fa-triangle-exclamation', tone: 'text-danger' },
    { label: 'Failed payment attempts', value: overview.attention.failed_payments, href: '/transactions', icon: 'fa-circle-xmark', tone: 'text-danger' },
    { label: 'Expired checkout sessions', value: overview.attention.expired_sessions, href: '/sessions', icon: 'fa-clock', tone: 'text-accent' },
    { label: 'IMEI actions required', value: overview.attention.imei_actions_required, href: '/subsidy', icon: 'fa-mobile-screen-button', tone: 'text-info' },
  ].filter((item) => item.value > 0);

  return (
    <div className="space-y-7 max-w-[1500px]">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold text-accent uppercase tracking-wider mb-2">Checkout command center</p>
          <h2 className="text-2xl font-bold text-fg">Today&apos;s payment pulse</h2>
          <p className="text-fg-muted text-sm mt-1">Daily GMV, payment mix, and exceptions that need action.</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={period} onChange={(event) => setPeriod(event.target.value as Period)} className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-fg outline-none focus:border-accent" aria-label="Dashboard period">
            {PERIODS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <Link href="/analytics" className="flex items-center gap-2 bg-surface border border-border hover:bg-surface-2 text-fg font-semibold px-4 py-2 rounded-lg transition text-sm"><i className="fa-solid fa-chart-line text-xs"></i>Explore analytics</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard label="Today&apos;s GMV" value={formatINR(today.gross_payment_volume)} note={gmvChange.label} icon="fa-indian-rupee-sign" tone="accent" />
        <MetricCard label="Paid orders today" value={today.paid_orders.toLocaleString()} note={orderChange.label} icon="fa-bag-shopping" tone="success" />
        <MetricCard label="Payment success" value={`${overview.performance.payment_attempt_success_rate}%`} note={`Across the selected ${period.replace('d', '-day')} period`} icon="fa-circle-check" tone="success" />
        <MetricCard label="Average order value" value={formatINR(overview.performance.average_order_value)} note={`${overview.performance.paid_orders.toLocaleString()} paid orders in period`} icon="fa-chart-simple" tone="info" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.55fr_0.85fr] gap-6">
        <section className="bg-surface rounded-2xl border border-border p-6 overflow-hidden">
          <div className="flex items-start justify-between gap-4 mb-7">
            <div>
              <h3 className="text-lg font-bold text-fg">Daily GMV</h3>
              <p className="text-sm text-fg-muted mt-1">Paid order value settled through your checkout.</p>
            </div>
            <div className="text-right shrink-0"><p className="text-xl font-bold text-fg">{formatINR(overview.performance.gross_payment_volume)}</p><p className="text-xs text-fg-muted mt-1">selected period</p></div>
          </div>
          {activeGMVDays.length < 2 ? (
            <div className="h-56 rounded-xl border border-dashed border-border bg-surface-2/50 flex flex-col items-center justify-center text-center px-6" style={{ backgroundImage: 'linear-gradient(to right, rgb(255 255 255 / 0.025) 1px, transparent 1px), linear-gradient(to bottom, rgb(255 255 255 / 0.025) 1px, transparent 1px)', backgroundSize: '28px 28px' }}>
              <div className="w-11 h-11 rounded-xl bg-accent/10 text-accent flex items-center justify-center mb-4"><i className="fa-solid fa-chart-area"></i></div>
              <p className="font-semibold text-fg">Your GMV trend is just getting started</p>
              <p className="text-sm text-fg-muted mt-1">The chart will appear after payments are recorded on two separate days.</p>
              <p className="text-sm text-accent font-semibold mt-4">Today: {formatINR(today.gross_payment_volume)} across {today.paid_orders} paid order{today.paid_orders === 1 ? '' : 's'}</p>
            </div>
          ) : (
            <div className="h-56" aria-label="Daily GMV area chart">
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" className="w-full h-full overflow-visible" role="img" aria-label="Daily gross payment volume">
                <defs>
                  <linearGradient id="gmv-area" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.32" />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[40, 102, 164].map((y) => <line key={y} x1="28" x2={chartWidth - 28} y1={y} y2={y} stroke="currentColor" strokeOpacity="0.12" strokeDasharray="3 4" />)}
                <text x="0" y="43" fill="#71809a" fontSize="10">{formatINR(maxGMV)}</text>
                <text x="12" y="168" fill="#71809a" fontSize="10">₹0</text>
                <path d={areaPath} className="text-accent" fill="url(#gmv-area)" />
                <path d={linePath} className="text-accent" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                {chartPoints.filter((point) => point.gross_payment_volume > 0).map((point) => (
                  <g key={point.date} className="text-accent">
                    <circle cx={point.x} cy={point.y} r="5" fill="currentColor" stroke="#121722" strokeWidth="3"><title>{`${dayLabel(point.date)}: ${formatINR(point.gross_payment_volume)} from ${point.paid_orders} paid orders`}</title></circle>
                  </g>
                ))}
                {[0, Math.floor(chartPoints.length / 2), chartPoints.length - 1].map((index) => {
                  const point = chartPoints[index];
                  return <text key={point.date} x={point.x} y="187" textAnchor="middle" fill="#71809a" fontSize="10">{dayLabel(point.date)}</text>;
                })}
              </svg>
            </div>
          )}
        </section>

        <section className="bg-surface rounded-2xl border border-border p-6">
          <div className="flex items-center justify-between mb-5"><div><h3 className="text-lg font-bold text-fg">Needs attention</h3><p className="text-sm text-fg-muted mt-1">Exceptions that can affect today&apos;s GMV.</p></div><span className={`w-2.5 h-2.5 rounded-full ${attentionItems.length ? 'bg-accent' : 'bg-success'}`}></span></div>
          {attentionItems.length === 0 ? (
            <div className="flex items-center gap-3 py-7 text-success"><i className="fa-solid fa-circle-check text-xl"></i><div><p className="font-semibold text-sm">All clear</p><p className="text-xs text-fg-muted mt-0.5">No revenue-impacting exceptions.</p></div></div>
          ) : <div className="space-y-1">{attentionItems.map((item) => (
            <Link key={item.label} href={item.href} className="flex items-center gap-3 p-3 -mx-3 rounded-lg hover:bg-surface-2 transition"><i className={`fa-solid ${item.icon} w-4 text-center ${item.tone}`}></i><span className="flex-1 text-sm text-fg-soft">{item.label}</span><span className="font-bold text-fg">{item.value}</span><i className="fa-solid fa-chevron-right text-[10px] text-fg-muted"></i></Link>
          ))}</div>}
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-surface rounded-2xl border border-border p-6">
          <div className="flex items-center justify-between mb-5"><div><h3 className="text-lg font-bold text-fg">Payment method mix</h3><p className="text-sm text-fg-muted mt-1">Successful checkout payments in the selected period.</p></div><Link href="/analytics" className="text-accent text-sm font-semibold hover:opacity-75">Deep dive</Link></div>
          {!overview.payment_methods.length ? <p className="py-8 text-center text-sm text-fg-muted">No successful payments in this period.</p> : <div className="space-y-4">{overview.payment_methods.map((method) => {
            const share = paymentVolume > 0 ? Math.round((method.payment_volume / paymentVolume) * 100) : 0;
            return <div key={method.payment_method}><div className="flex justify-between gap-4 text-sm mb-2"><span className="font-semibold text-fg capitalize">{method.payment_method}</span><span className="text-fg-muted">{formatINR(method.payment_volume)} <span className="text-fg">{share}%</span></span></div><div className="h-2 bg-surface-2 rounded-full overflow-hidden"><div className="h-full bg-info rounded-full" style={{ width: `${share}%` }}></div></div><p className="text-xs text-fg-muted mt-1.5">{method.successful_payments} successful payments</p></div>;
          })}</div>}
        </section>

        <section className="bg-surface rounded-2xl border border-border p-6">
          <div className="flex items-center justify-between mb-5"><div><h3 className="text-lg font-bold text-fg">Gateway routing</h3><p className="text-sm text-fg-muted mt-1">Where successful checkout payments were processed.</p></div><Link href="/pg-health" className="text-accent text-sm font-semibold hover:opacity-75">PG health</Link></div>
          {!overview.payment_gateways.length ? <p className="py-8 text-center text-sm text-fg-muted">No gateway payments in this period.</p> : <div className="space-y-3">{overview.payment_gateways.map((gateway) => (
            <div key={gateway.pg_name} className="flex items-center gap-4 rounded-xl bg-surface-2 px-4 py-3"><div className="w-9 h-9 rounded-lg bg-bg flex items-center justify-center"><i className="fa-solid fa-server text-info text-sm"></i></div><div className="flex-1"><p className="font-semibold text-fg capitalize">{gateway.pg_name}</p><p className="text-xs text-fg-muted mt-1">{gateway.successful_payments} successful payments</p></div><p className="font-bold text-fg">{formatINR(gateway.payment_volume)}</p></div>
          ))}</div>}
        </section>
      </div>

      <section className="bg-surface rounded-2xl border border-border overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-border"><div><h3 className="text-lg font-bold text-fg">Recent payment outcomes</h3><p className="text-sm text-fg-muted mt-1">Latest activity across your checkout.</p></div><Link href="/transactions" className="text-accent text-sm font-semibold hover:opacity-75">View all</Link></div>
        {overview.recent_activity.length === 0 ? <p className="p-8 text-center text-sm text-fg-muted">No payment activity in this period.</p> : <div className="divide-y divide-border">{overview.recent_activity.map((activity) => (
          <Link key={activity.id} href={activity.destination} className="flex items-center gap-4 px-6 py-4 hover:bg-surface-2 transition"><div className={`w-9 h-9 rounded-full flex items-center justify-center ${statusClass(activity.status)}`}><i className={`fa-solid ${activity.status === 'success' ? 'fa-check' : activity.status === 'failed' ? 'fa-xmark' : 'fa-clock'} text-xs`}></i></div><div className="flex-1 min-w-0"><p className="text-sm font-semibold text-fg capitalize">Payment {activity.status}</p><p className="text-xs text-fg-muted mt-0.5 font-mono truncate">{activity.id}</p></div><div className="text-right"><p className="text-sm font-semibold text-fg">{activity.amount !== undefined ? formatINR(activity.amount) : '—'}</p><p className="text-xs text-fg-muted mt-0.5">{new Date(activity.occurred_at).toLocaleDateString('en-IN')}</p></div></Link>
        ))}</div>}
      </section>
    </div>
  );
}
