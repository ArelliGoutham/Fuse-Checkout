'use client';

import { useState, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { AuthGuard } from '@/components/AuthGuard';

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { href: '/', label: 'Dashboard', icon: 'fa-gauge-high' },
      { href: '/analytics', label: 'Analytics', icon: 'fa-chart-line' },
      { href: '/transactions', label: 'Transactions', icon: 'fa-receipt' },
    ],
  },
  {
    label: 'Offers',
    items: [
      { href: '/create', label: 'Create Offer', icon: 'fa-plus-circle' },
      { href: '/rules', label: 'Stacking Policy', icon: 'fa-layer-group' },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { href: '/products', label: 'Products', icon: 'fa-cube' },
      { href: '/combos', label: 'Combos', icon: 'fa-box' },
    ],
  },
  {
    label: 'Settings',
    items: [
      { href: '/api-keys', label: 'API Keys', icon: 'fa-key' },
      { href: '/settings', label: 'Payment Gateway', icon: 'fa-plug' },
    ],
  },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <AuthGuard>
      <div className="flex h-screen bg-bg">
        {/* Sidebar */}
        <div className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-surface border-r border-border flex flex-col transition-all duration-300`}>
          {/* Brand */}
          <Link href="/" className="px-6 py-6 flex items-center gap-3 hover:opacity-80 transition">
            <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center flex-shrink-0">
              <i className="fa-solid fa-bolt text-bg text-lg"></i>
            </div>
            {sidebarOpen && <span className="font-bold text-fg">Fuse</span>}
          </Link>

          {/* Navigation */}
          <nav className="flex-1 px-3 space-y-6 overflow-y-auto py-4">
            {NAV_GROUPS.map((group) => (
              <div key={group.label}>
                {sidebarOpen && (
                  <p className="text-xs font-semibold text-fg-muted uppercase tracking-wider px-3 mb-3">{group.label}</p>
                )}
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition ${
                          isActive
                            ? 'bg-accent/10 text-accent'
                            : 'text-fg-soft hover:text-fg hover:bg-surface-2'
                        }`}
                      >
                        <i className={`fa-solid ${item.icon} text-sm w-5 text-center flex-shrink-0`}></i>
                        {sidebarOpen && <span className="text-sm">{item.label}</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Merchant Card */}
          {sidebarOpen && (
            <div className="px-3 py-4 border-t border-border">
              <div className="bg-surface-2 rounded-lg p-3 flex items-center gap-3">
                <div className="w-10 h-10 bg-accent/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <i className="fa-solid fa-user text-accent text-xs"></i>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-fg truncate">Acme Corp</p>
                  <p className="text-xs text-fg-muted">Premium Plan</p>
                </div>
              </div>
            </div>
          )}

          {/* Toggle Button */}
          <div className="p-3 border-t border-border">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="w-full flex items-center justify-center py-2 text-fg-soft hover:text-fg transition"
            >
              <i className={`fa-solid fa-chevron-${sidebarOpen ? 'left' : 'right'} text-xs`}></i>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Topbar */}
          <div className="sticky top-0 h-16 bg-surface border-b border-border flex items-center justify-between px-8 z-40">
            <div>
              <h1 className="text-lg font-bold text-fg">Dashboard</h1>
              <p className="text-xs text-fg-muted">Welcome to your offer management center</p>
            </div>
            <div className="flex items-center gap-4">
              {/* API Key Indicator */}
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-success rounded-full"></div>
                <span className="text-fg-soft">of_live_••••3f8a</span>
              </div>
              {/* Create Offer Button */}
              <Link
                href="/create"
                className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-bg font-semibold px-4 py-2 rounded-lg transition"
              >
                <i className="fa-solid fa-plus text-xs"></i>
                Create Offer
              </Link>
            </div>
          </div>

          {/* Page Content */}
          <div className="flex-1 overflow-y-auto bg-bg p-8">{children}</div>
        </div>
      </div>
    </AuthGuard>
  );
}
