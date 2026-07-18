'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

interface Offer {
  _id: string;
  code: string | null;
  type: 'coupon' | 'auto_offer';
  title: string;
  status: string;
  discount: { type: 'flat' | 'percentage'; value: number; max_discount: number | null };
  usage_count: number;
  usage_limits: { total: number | null; per_customer: number | null };
  rules: { rule_type: string; config: Record<string, unknown> }[];
  validity: { starts_at: string; ends_at: string };
}

interface Analytics {
  total_redemptions: number;
  conversions: number;
  abandoned: number;
  conversion_rate: number;
  revenue_via_offers: number;
  total_discount_given: number;
}

export default function DashboardPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [offersRes, analyticsRes] = await Promise.all([
          apiFetch('/api/offers'),
          apiFetch('/api/analytics/overview'),
        ]);
        setOffers(offersRes.offers || []);
        setAnalytics(analyticsRes);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <i className="fa-solid fa-spinner fa-spin text-accent text-2xl"></i>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-danger/10 border border-danger/20 rounded-xl p-6 text-center">
        <i className="fa-solid fa-circle-exclamation text-danger text-2xl mb-3"></i>
        <p className="text-danger font-medium">{error}</p>
        <p className="text-fg-muted text-sm mt-2">Make sure the API server is running on port 3010</p>
      </div>
    );
  }

  const metrics = [
    { label: 'Total Redemptions', value: analytics?.total_redemptions?.toLocaleString() ?? '0', icon: 'fa-rotate', color: 'text-accent', bg: 'bg-accent/10' },
    { label: 'Conversion Rate', value: `${Math.round(analytics?.conversion_rate ?? 0)}%`, icon: 'fa-arrow-trend-up', color: 'text-success', bg: 'bg-success/10' },
    { label: 'Revenue via Offers', value: `₹${(analytics?.revenue_via_offers ?? 0).toLocaleString('en-IN')}`, icon: 'fa-chart-line', color: 'text-info', bg: 'bg-info/10' },
    { label: 'Active Offers', value: offers.filter(o => o.status === 'active').length.toString(), icon: 'fa-tag', color: 'text-danger', bg: 'bg-danger/10' },
  ];

  function formatDiscount(offer: Offer): string {
    if (offer.discount.type === 'flat') return `₹${offer.discount.value} off`;
    return `${offer.discount.value}% off${offer.discount.max_discount ? ` (max ₹${offer.discount.max_discount})` : ''}`;
  }

  function formatRules(rules: Offer['rules']): string[] {
    return rules.map(r => r.rule_type.replace(/_/g, ' '));
  }

  return (
    <div className="space-y-8">
      {/* Metrics Grid */}
      <div className="grid grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="bg-surface rounded-2xl border border-border p-6">
            <div className="flex items-start justify-between mb-4">
              <div className={`w-12 h-12 ${metric.bg} rounded-lg flex items-center justify-center`}>
                <i className={`fa-solid ${metric.icon} ${metric.color} text-lg`}></i>
              </div>
            </div>
            <p className="text-fg-muted text-sm mb-1">{metric.label}</p>
            <p className="text-2xl font-bold text-fg">{metric.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-8">
        {/* Active Offers */}
        <div className="col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-fg">Active Offers</h2>
            <Link href="/create" className="text-accent hover:text-accent-hover transition text-sm font-semibold">
              Create Offer →
            </Link>
          </div>
          <div className="space-y-4">
            {offers.length === 0 ? (
              <div className="bg-surface rounded-2xl border border-border p-8 text-center text-fg-muted">
                <i className="fa-solid fa-tag text-2xl mb-3"></i>
                <p>No offers yet. Create your first offer!</p>
              </div>
            ) : offers.map((offer) => (
              <div key={offer._id} className="bg-surface rounded-2xl border border-border p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      offer.type === 'coupon' ? 'bg-info/10' : 'bg-accent/10'
                    }`}>
                      <i className={`fa-solid ${offer.type === 'coupon' ? 'fa-tag' : 'fa-bolt'} ${
                        offer.type === 'coupon' ? 'text-info' : 'text-accent'
                      }`}></i>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-bold text-fg">{offer.title}</h3>
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                          offer.status === 'active'
                            ? 'bg-success/10 text-success' : 'bg-fg-muted/10 text-fg-muted'
                        }`}>
                          ● {offer.status}
                        </span>
                      </div>
                      <p className="text-sm text-fg-soft font-mono">{offer.code || 'Auto-applied'}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4 py-3 border-t border-b border-border">
                  <div>
                    <p className="text-xs text-fg-muted">{formatDiscount(offer)}</p>
                    <p className="text-sm font-semibold text-fg">{offer.usage_count.toLocaleString()} redeemed</p>
                  </div>
                  <div>
                    <p className="text-xs text-fg-muted">Type</p>
                    <p className="text-sm font-semibold text-fg capitalize">{offer.type.replace('_', ' ')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-fg-muted">Usage Limit</p>
                    <p className="text-sm font-semibold text-fg">{offer.usage_limits.total ?? 'Unlimited'}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {formatRules(offer.rules).map((rule, idx) => (
                    <span key={idx} className="text-xs bg-surface-2 text-fg-soft px-2.5 py-1 rounded-full">
                      {rule}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <h2 className="text-xl font-bold text-fg mb-6">Recent Activity</h2>
          <div className="bg-surface rounded-2xl border border-border p-6 space-y-4">
            <div className="flex gap-3">
              <div className="flex-shrink-0 pt-1">
                <i className="fa-solid fa-circle-check text-success"></i>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-fg">{analytics?.conversions ?? 0} conversions</p>
                <p className="text-xs text-fg-muted">From {analytics?.total_redemptions ?? 0} total redemptions</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 pt-1">
                <i className="fa-solid fa-arrow-right text-accent"></i>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-fg">₹{(analytics?.total_discount_given ?? 0).toLocaleString('en-IN')} discounts given</p>
                <p className="text-xs text-fg-muted">Total savings across all offers</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 pt-1">
                <i className="fa-solid fa-circle-xmark text-danger"></i>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-fg">{analytics?.abandoned ?? 0} abandoned</p>
                <p className="text-xs text-fg-muted">Offers applied but not converted</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
