'use client';

const metrics = [
  {
    label: 'Total Redemptions',
    value: '45,287',
    icon: 'fa-check-circle',
    period: 'Last 30 days',
    trend: '+12.5%',
  },
  {
    label: 'Conversion Rate',
    value: '8.2%',
    icon: 'fa-chart-pie',
    period: 'Last 30 days',
    trend: '+3.1%',
  },
  {
    label: 'Revenue Impact',
    value: '$187,450',
    icon: 'fa-dollar-sign',
    period: 'Last 30 days',
    trend: '+28.9%',
  },
];

const offerPerformance = [
  {
    name: 'Summer Sale 2024',
    code: 'SUMMER20',
    redemptions: 8542,
    conversionRate: 8.5,
    revenue: '$68,450',
    topSegment: 'New Customers',
  },
  {
    name: 'Free Shipping',
    code: 'FREESHIP',
    redemptions: 12487,
    conversionRate: 10.2,
    revenue: '$98,760',
    topSegment: 'Repeat Customers',
  },
  {
    name: 'Spring Flash Deal',
    code: 'SPRING15',
    redemptions: 5234,
    conversionRate: 6.1,
    revenue: '$12,340',
    topSegment: 'High-Value',
  },
  {
    name: 'Bundle Bonus',
    code: 'BUNDLE25',
    redemptions: 4567,
    conversionRate: 7.3,
    revenue: '$7,900',
    topSegment: 'Mobile Users',
  },
];

const customerSegments = [
  { name: 'New Customers', offers: 12, totalRedemptions: 18543, conversionRate: 12.4, avgOrderValue: '$156.80' },
  { name: 'Repeat Customers', offers: 8, totalRedemptions: 15487, conversionRate: 9.1, avgOrderValue: '$234.50' },
  { name: 'High-Value', offers: 6, totalRedemptions: 7234, conversionRate: 14.6, avgOrderValue: '$428.20' },
  { name: 'At-Risk (Inactive)', offers: 4, totalRedemptions: 2134, conversionRate: 5.2, avgOrderValue: '$89.30' },
  { name: 'VIP', offers: 3, totalRedemptions: 1889, conversionRate: 18.2, avgOrderValue: '$652.10' },
];

export default function AnalyticsPage() {
  return (
    <div className="space-y-8">
      {/* Metrics */}
      <div className="grid grid-cols-3 gap-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="bg-surface rounded-2xl border border-border p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                <i className={`fa-solid ${metric.icon} text-accent text-lg`}></i>
              </div>
              <span className="text-xs font-semibold text-success">{metric.trend}</span>
            </div>
            <p className="text-fg-muted text-xs mb-1">{metric.label}</p>
            <p className="text-2xl font-bold text-fg mb-3">{metric.value}</p>
            <p className="text-xs text-fg-muted">{metric.period}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-8">
        {/* Per-Offer Performance */}
        <div>
          <h2 className="text-xl font-bold text-fg mb-6">Per-Offer Performance</h2>
          <div className="space-y-3">
            {offerPerformance.map((offer) => (
              <div key={offer.code} className="bg-surface rounded-xl border border-border p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-fg">{offer.name}</h3>
                    <p className="text-xs text-fg-muted font-mono">{offer.code}</p>
                  </div>
                  <span className="text-xs bg-info/10 text-info px-2 py-1 rounded">Top segment: {offer.topSegment}</span>
                </div>
                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-border">
                  <div>
                    <p className="text-xs text-fg-muted">Redemptions</p>
                    <p className="text-sm font-bold text-fg">{offer.redemptions.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-fg-muted">Conversion</p>
                    <p className="text-sm font-bold text-fg">{offer.conversionRate}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-fg-muted">Revenue</p>
                    <p className="text-sm font-bold text-fg">{offer.revenue}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Customer Segments */}
        <div>
          <h2 className="text-xl font-bold text-fg mb-6">Customer Segments</h2>
          <div className="bg-surface rounded-2xl border border-border overflow-hidden">
            <table className="w-full">
              <thead className="bg-surface-2 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-fg-muted">Segment</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-fg-muted">Offers</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-fg-muted">Redemptions</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-fg-muted">Conv. Rate</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-fg-muted">AOV</th>
                </tr>
              </thead>
              <tbody>
                {customerSegments.map((segment) => (
                  <tr key={segment.name} className="border-b border-border hover:bg-surface-2 transition">
                    <td className="px-4 py-3 text-sm text-fg font-medium">{segment.name}</td>
                    <td className="px-4 py-3 text-sm text-fg-muted">{segment.offers}</td>
                    <td className="px-4 py-3 text-sm text-fg font-semibold">{segment.totalRedemptions.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="text-fg font-semibold">{segment.conversionRate}%</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-fg font-semibold">{segment.avgOrderValue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
