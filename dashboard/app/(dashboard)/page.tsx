'use client';

import Link from 'next/link';

// Mock data
const metrics = [
  {
    label: 'Total Redemptions',
    value: '12,487',
    icon: 'fa-check-circle',
    delta: '+24.5%',
    trend: 'up',
  },
  {
    label: 'Conversion Rate',
    value: '6.8%',
    icon: 'fa-chart-pie',
    delta: '+2.1%',
    trend: 'up',
  },
  {
    label: 'Revenue via Offers',
    value: '$45,230',
    icon: 'fa-dollar-sign',
    delta: '+18.3%',
    trend: 'up',
  },
  {
    label: 'AOV Lift',
    value: '34%',
    icon: 'fa-arrow-trend-up',
    delta: '+5.2%',
    trend: 'up',
  },
];

const activeOffers = [
  {
    id: 1,
    name: 'Summer Sale 2024',
    code: 'SUMMER20',
    type: 'coupon',
    status: 'active',
    usageCount: 3842,
    conversionRate: 6.5,
    discount: '20% off',
    rules: ['Min $50', 'Max 1 per customer'],
  },
  {
    id: 2,
    name: 'Free Shipping',
    code: 'FREESHIP',
    type: 'auto',
    status: 'active',
    usageCount: 5124,
    conversionRate: 8.2,
    discount: 'Free shipping',
    rules: ['Min $35', 'Exclude gifts'],
  },
  {
    id: 3,
    name: 'Spring Flash Deal',
    code: 'SPRING15',
    type: 'coupon',
    status: 'active',
    usageCount: 2156,
    conversionRate: 4.8,
    discount: '15% off',
    rules: ['15% max', 'Active 24h'],
  },
  {
    id: 4,
    name: 'Bundle Bonus',
    code: 'BUNDLE25',
    type: 'coupon',
    status: 'ending-soon',
    usageCount: 1823,
    conversionRate: 5.2,
    discount: '25% on bundles',
    rules: ['Min 3 items', 'Categories: X,Y,Z'],
  },
];

const recentActivity = [
  { icon: 'fa-check-circle', color: 'text-success', label: 'Offer redeemed', details: 'SUMMER20 by customer #4521', time: '2 mins ago' },
  { icon: 'fa-arrow-right-to-bracket', color: 'text-info', label: 'Coupon applied', details: 'FREESHIP - cart value $67.50', time: '5 mins ago' },
  { icon: 'fa-arrow-left-to-bracket', color: 'text-danger', label: 'Offer abandoned', details: 'SPRING15 - didn\'t complete purchase', time: '12 mins ago' },
  { icon: 'fa-check-circle', color: 'text-success', label: 'Offer redeemed', details: 'BUNDLE25 - order value $285', time: '18 mins ago' },
  { icon: 'fa-arrow-right-to-bracket', color: 'text-info', label: 'Coupon applied', details: 'SUMMER20 - cart value $102', time: '24 mins ago' },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Metrics Grid */}
      <div className="grid grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="bg-surface rounded-2xl border border-border p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                <i className={`fa-solid ${metric.icon} text-accent text-lg`}></i>
              </div>
              <div className={`text-xs font-semibold ${metric.trend === 'up' ? 'text-success' : 'text-danger'}`}>
                {metric.delta}
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
            {activeOffers.map((offer) => (
              <div key={offer.id} className="bg-surface rounded-2xl border border-border p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      offer.type === 'coupon' ? 'bg-info/10' : 'bg-accent/10'
                    }`}>
                      <i className={`fa-solid ${offer.type === 'coupon' ? 'fa-ticket' : 'fa-gift'} ${
                        offer.type === 'coupon' ? 'text-info' : 'text-accent'
                      }`}></i>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-bold text-fg">{offer.name}</h3>
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                          offer.status === 'active'
                            ? 'bg-success/10 text-success'
                            : 'bg-danger/10 text-danger'
                        }`}>
                          {offer.status === 'active' ? '● Active' : '● Ending soon'}
                        </span>
                      </div>
                      <p className="text-sm text-fg-soft font-mono">{offer.code}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-2 hover:bg-surface-3 transition">
                      <i className="fa-solid fa-toggle-on text-accent text-lg"></i>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4 py-3 border-t border-b border-border">
                  <div>
                    <p className="text-xs text-fg-muted">{offer.discount}</p>
                    <p className="text-sm font-semibold text-fg">{offer.usageCount.toLocaleString()} redeemed</p>
                  </div>
                  <div>
                    <p className="text-xs text-fg-muted">Conversion Rate</p>
                    <p className="text-sm font-semibold text-fg">{offer.conversionRate}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-fg-muted">Type</p>
                    <p className="text-sm font-semibold text-fg capitalize">{offer.type}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {offer.rules.map((rule, idx) => (
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
            {recentActivity.map((activity, idx) => (
              <div key={idx} className="flex gap-3">
                <div className="flex-shrink-0 pt-1">
                  <i className={`fa-solid ${activity.icon} ${activity.color}`}></i>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-fg">{activity.label}</p>
                  <p className="text-xs text-fg-muted truncate">{activity.details}</p>
                  <p className="text-xs text-fg-muted mt-1">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
