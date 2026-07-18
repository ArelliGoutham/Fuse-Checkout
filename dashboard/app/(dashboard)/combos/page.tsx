'use client';

import { useState } from 'react';

interface Combo {
  id: string;
  name: string;
  skus: string[];
  type: 'bundle' | 'tiered' | 'spend';
  createdAt: string;
  active: boolean;
}

const combos: Combo[] = [
  {
    id: '1',
    name: 'Summer Essentials Bundle',
    skus: ['TSHIRT-001', 'CAP-001', 'SOCKS-001'],
    type: 'bundle',
    createdAt: '2024-06-15',
    active: true,
  },
  {
    id: '2',
    name: 'Cold Weather Combo',
    skus: ['JACKET-001', 'CAP-001', 'SOCKS-001'],
    type: 'bundle',
    createdAt: '2024-05-20',
    active: true,
  },
  {
    id: '3',
    name: 'Footwear Collection',
    skus: ['SHOES-001', 'SHOES-002'],
    type: 'tiered',
    createdAt: '2024-04-10',
    active: true,
  },
  {
    id: '4',
    name: 'Complete Wardrobe',
    skus: ['TSHIRT-001', 'JEANS-001', 'JACKET-001'],
    type: 'spend',
    createdAt: '2024-03-05',
    active: false,
  },
  {
    id: '5',
    name: 'Casual Friday Pack',
    skus: ['TSHIRT-001', 'JEANS-001', 'SHOES-002'],
    type: 'bundle',
    createdAt: '2024-02-28',
    active: true,
  },
  {
    id: '6',
    name: 'Premium Collection',
    skus: ['HOODIE-001', 'SHOES-001', 'CAP-001'],
    type: 'tiered',
    createdAt: '2024-01-15',
    active: true,
  },
];

const comboTypeLabels = {
  bundle: { label: 'Bundle', icon: 'fa-box', color: 'text-info' },
  tiered: { label: 'Tiered', icon: 'fa-layer-group', color: 'text-accent' },
  spend: { label: 'Spend-Based', icon: 'fa-wallet', color: 'text-success' },
};

export default function CombosPage() {
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const filteredCombos = activeFilter === 'all' ? combos : combos.filter((c) => (activeFilter === 'active' ? c.active : !c.active));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-fg">Product Combos</h1>
          <p className="text-sm text-fg-muted mt-1">Create and manage product bundles and combos</p>
        </div>
        <button className="px-4 py-2 bg-accent text-bg rounded-[10px] text-sm font-semibold hover:bg-accent/90 transition flex items-center gap-2">
          <i className="fa-solid fa-plus text-sm"></i>
          Create Combo
        </button>
      </div>

      {/* Filter */}
      <div className="bg-surface rounded-2xl border border-border p-4 flex items-center gap-4">
        <label className="text-xs font-medium text-fg-muted">Show:</label>
        <div className="flex gap-2">
          {['all', 'active', 'inactive'].map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter as typeof activeFilter)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeFilter === filter
                  ? 'bg-accent text-bg'
                  : 'bg-surface-2 text-fg-muted hover:text-fg'
              }`}
            >
              {filter === 'all' ? 'All' : filter === 'active' ? 'Active' : 'Inactive'}
            </button>
          ))}
        </div>
        <span className="text-xs text-fg-muted ml-auto">{filteredCombos.length} combos</span>
      </div>

      {/* Combo Grid */}
      <div className="grid grid-cols-2 gap-6">
        {filteredCombos.map((combo) => (
          <div
            key={combo.id}
            className={`bg-surface rounded-2xl border border-border p-6 hover:border-border/80 transition group cursor-pointer ${
              !combo.active ? 'opacity-60' : ''
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-bold text-fg">{combo.name}</h3>
                  {!combo.active && (
                    <span className="px-2 py-0.5 text-xs bg-danger/10 text-danger rounded-full font-medium">
                      Inactive
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <i className={`fa-solid ${comboTypeLabels[combo.type].icon} text-xs ${comboTypeLabels[combo.type].color}`}></i>
                  <span className={`text-xs font-medium ${comboTypeLabels[combo.type].color}`}>
                    {comboTypeLabels[combo.type].label}
                  </span>
                </div>
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                <button
                  className="p-2 bg-surface-2 text-fg-muted hover:text-accent rounded-lg transition"
                  title="Edit"
                >
                  <i className="fa-solid fa-pen-to-square text-sm"></i>
                </button>
                <button
                  className="p-2 bg-surface-2 text-fg-muted hover:text-danger rounded-lg transition"
                  title="Delete"
                >
                  <i className="fa-solid fa-trash text-sm"></i>
                </button>
              </div>
            </div>

            {/* Product SKUs */}
            <div className="pt-4 border-t border-border">
              <p className="text-xs text-fg-muted mb-2 font-medium">Products ({combo.skus.length})</p>
              <div className="flex flex-wrap gap-2">
                {combo.skus.map((sku) => (
                  <span
                    key={sku}
                    className="px-2.5 py-1 bg-accent/10 text-accent rounded-lg text-xs font-mono font-medium"
                  >
                    {sku}
                  </span>
                ))}
              </div>
            </div>

            {/* Meta Info */}
            <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
              <p className="text-xs text-fg-muted">Created {new Date(combo.createdAt).toLocaleDateString()}</p>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${combo.active ? 'bg-success' : 'bg-fg-muted'}`}></span>
                <span className="text-xs text-fg-muted">{combo.active ? 'Live' : 'Draft'}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredCombos.length === 0 && (
        <div className="bg-surface rounded-2xl border border-border p-12 text-center">
          <i className="fa-solid fa-inbox text-4xl text-fg-muted/30 mb-4 block"></i>
          <p className="text-fg-muted text-sm">No combos found</p>
        </div>
      )}
    </div>
  );
}
