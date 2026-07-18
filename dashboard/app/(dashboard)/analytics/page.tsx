'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

interface Analytics {
  total_redemptions: number;
  conversions: number;
  abandoned: number;
  conversion_rate: number;
  revenue_via_offers: number;
  total_discount_given: number;
}

interface OfferAnalytics {
  offer_id: string;
  redemptions: number;
  conversions: number;
  revenue: number;
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [offerStats, setOfferStats] = useState<OfferAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch('/api/analytics/overview'),
      apiFetch('/api/analytics/offers'),
    ])
      .then(([overview, offers]) => {
        setAnalytics(overview);
        setOfferStats(offers.offers || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-12"><i className="fa-solid fa-spinner fa-spin text-accent text-2xl"></i></div>;
  if (error) return <div className="bg-danger/10 border border-danger/20 rounded-xl p-6 text-danger text-center">{error}</div>;

  const metrics = [
    { label: 'Total Redemptions', value: (analytics?.total_redemptions ?? 0).toLocaleString(), icon: 'fa-rotate', color: 'text-accent', bg: 'bg-accent/10' },
    { label: 'Conversion Rate', value: `${Math.round(analytics?.conversion_rate ?? 0)}%`, icon: 'fa-arrow-trend-up', color: 'text-success', bg: 'bg-success/10' },
    { label: 'Revenue via Offers', value: `₹${(analytics?.revenue_via_offers ?? 0).toLocaleString('en-IN')}`, icon: 'fa-chart-line', color: 'text-info', bg: 'bg-info/10' },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-3 gap-4">
        {metrics.map((m) => (
          <div key={m.label} className="bg-surface rounded-2xl border border-border p-6">
            <div className="w-12 h-12 ${m.bg} rounded-lg flex items-center justify-center mb-4">
              <i className={`fa-solid ${m.icon} ${m.color} text-lg`}></i>
            </div>
            <p className="text-fg-muted text-xs mb-1">{m.label}</p>
            <p className="text-2xl font-bold text-fg">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-8">
        <div>
          <h2 className="text-xl font-bold text-fg mb-6">Per-Offer Performance</h2>
          <div className="space-y-3">
            {offerStats.length === 0 ? (
              <div className="bg-surface rounded-xl border border-border p-8 text-center text-fg-muted">No data yet</div>
            ) : offerStats.map((offer) => (
              <div key={offer.offer_id} className="bg-surface rounded-xl border border-border p-4">
                <h3 className="font-semibold text-fg mb-3">{offer.offer_id}</h3>
                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-border">
                  <div><p className="text-xs text-fg-muted">Redemptions</p><p className="text-sm font-bold">{offer.redemptions}</p></div>
                  <div><p className="text-xs text-fg-muted">Conversions</p><p className="text-sm font-bold text-success">{offer.conversions}</p></div>
                  <div><p className="text-xs text-fg-muted">Revenue</p><p className="text-sm font-bold">₹{offer.revenue?.toLocaleString('en-IN') ?? 0}</p></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-fg mb-6">Summary</h2>
          <div className="bg-surface rounded-2xl border border-border p-6 space-y-4">
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-fg-muted text-sm">Total Redemptions</span>
              <span className="font-bold">{analytics?.total_redemptions ?? 0}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-fg-muted text-sm">Conversions</span>
              <span className="font-bold text-success">{analytics?.conversions ?? 0}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-fg-muted text-sm">Abandoned</span>
              <span className="font-bold text-danger">{analytics?.abandoned ?? 0}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-fg-muted text-sm">Total Discount Given</span>
              <span className="font-bold">₹{(analytics?.total_discount_given ?? 0).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-fg-muted text-sm">Revenue via Offers</span>
              <span className="font-bold text-success">₹{(analytics?.revenue_via_offers ?? 0).toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
