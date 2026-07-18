'use client';

import { useState } from 'react';

interface Priority {
  id: string;
  name: string;
  type: 'coupon' | 'auto';
}

interface CompatibilityRule {
  offer1: string;
  offer2: string;
  compatible: boolean;
}

export default function RulesPage() {
  const [maxCoupons, setMaxCoupons] = useState('2');
  const [maxAutoOffers, setMaxAutoOffers] = useState('1');
  const [maxTotalDiscount, setMaxTotalDiscount] = useState('50');
  const [allowCrossType, setAllowCrossType] = useState(true);
  const [exclusiveTags, setExclusiveTags] = useState<string[]>(['vip', 'flash-sale']);
  const [newTag, setNewTag] = useState('');
  const [priorities, setPriorities] = useState<Priority[]>([
    { id: '1', name: 'Summer Sale 2024', type: 'coupon' },
    { id: '2', name: 'Free Shipping', type: 'auto' },
    { id: '3', name: 'Spring Flash Deal', type: 'coupon' },
    { id: '4', name: 'Bundle Bonus', type: 'auto' },
  ]);
  const [algorithm, setAlgorithm] = useState<'highest-value' | 'best-outcome' | 'all'>('highest-value');

  const addTag = () => {
    if (newTag.trim() && !exclusiveTags.includes(newTag.trim())) {
      setExclusiveTags([...exclusiveTags, newTag.trim().toLowerCase()]);
      setNewTag('');
    }
  };

  const removeTag = (tag: string) => {
    setExclusiveTags(exclusiveTags.filter((t) => t !== tag));
  };

  const movePriority = (id: string, direction: 'up' | 'down') => {
    const index = priorities.findIndex((p) => p.id === id);
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === priorities.length - 1)) {
      return;
    }
    const newPriorities = [...priorities];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    [newPriorities[index], newPriorities[swapIndex]] = [newPriorities[swapIndex], newPriorities[index]];
    setPriorities(newPriorities);
  };

  const compatibilityMatrix: CompatibilityRule[] = [
    { offer1: 'Summer Sale 2024', offer2: 'Free Shipping', compatible: true },
    { offer1: 'Summer Sale 2024', offer2: 'Spring Flash Deal', compatible: false },
    { offer1: 'Summer Sale 2024', offer2: 'Bundle Bonus', compatible: true },
    { offer1: 'Free Shipping', offer2: 'Spring Flash Deal', compatible: true },
    { offer1: 'Free Shipping', offer2: 'Bundle Bonus', compatible: false },
    { offer1: 'Spring Flash Deal', offer2: 'Bundle Bonus', compatible: true },
  ];

  const allOffers = ['Summer Sale 2024', 'Free Shipping', 'Spring Flash Deal', 'Bundle Bonus'];

  return (
    <div className="space-y-8">
      {/* Global Policy */}
      <div className="bg-surface rounded-2xl border border-border p-6">
        <h2 className="text-xl font-bold text-fg mb-6">Global Stacking Policy</h2>

        <div className="grid grid-cols-2 gap-6 mb-8">
          <div>
            <label className="block text-sm font-medium text-fg mb-2">Max Coupons per Cart</label>
            <input
              type="number"
              value={maxCoupons}
              onChange={(e) => setMaxCoupons(e.target.value)}
              className="w-full bg-[#151821] border border-[#252836] rounded-[10px] px-3.5 py-2.5 text-fg text-sm focus:border-accent/50 outline-none transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-fg mb-2">Max Auto-Applied Offers</label>
            <input
              type="number"
              value={maxAutoOffers}
              onChange={(e) => setMaxAutoOffers(e.target.value)}
              className="w-full bg-[#151821] border border-[#252836] rounded-[10px] px-3.5 py-2.5 text-fg text-sm focus:border-accent/50 outline-none transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-fg mb-2">Max Total Discount (%)</label>
            <input
              type="number"
              value={maxTotalDiscount}
              onChange={(e) => setMaxTotalDiscount(e.target.value)}
              className="w-full bg-[#151821] border border-[#252836] rounded-[10px] px-3.5 py-2.5 text-fg text-sm focus:border-accent/50 outline-none transition"
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                className={`w-11 h-6 rounded-full transition ${allowCrossType ? 'bg-accent' : 'bg-[#252836]'}`}
                onClick={() => setAllowCrossType(!allowCrossType)}
              ></div>
              <span className="text-sm font-medium text-fg">Allow Cross-Type Stacking</span>
            </label>
          </div>
        </div>

        {/* Exclusive Tags */}
        <div>
          <label className="block text-sm font-medium text-fg mb-3">Exclusive Tags</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {exclusiveTags.map((tag) => (
              <div key={tag} className="bg-accent/10 text-accent px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2">
                {tag}
                <button onClick={() => removeTag(tag)} className="hover:text-accent/70">
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Add tag..."
              className="flex-1 bg-[#151821] border border-[#252836] rounded-[10px] px-3.5 py-2.5 text-fg text-sm focus:border-accent/50 outline-none transition"
              onKeyPress={(e) => e.key === 'Enter' && addTag()}
            />
            <button onClick={addTag} className="px-4 py-2 bg-accent/20 text-accent rounded-[10px] text-sm font-medium hover:bg-accent/30 transition">
              Add
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8">
        {/* Offer Priority */}
        <div>
          <h2 className="text-xl font-bold text-fg mb-6">Offer Priority Order</h2>
          <div className="bg-surface rounded-2xl border border-border p-4 space-y-2">
            {priorities.map((priority, index) => (
              <div key={priority.id} className="flex items-center justify-between bg-surface-2 rounded-lg p-3 group">
                <div className="flex items-center gap-3 flex-1">
                  <span className="text-xs font-bold text-fg-muted w-5 text-center">{index + 1}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-fg">{priority.name}</p>
                    <span className={`text-xs font-mono ${priority.type === 'coupon' ? 'text-info' : 'text-success'}`}>
                      {priority.type === 'coupon' ? '$ coupon' : '⚡ auto'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={() => movePriority(priority.id, 'up')}
                    disabled={index === 0}
                    className="p-1 text-fg-muted hover:text-accent disabled:opacity-30 disabled:cursor-not-allowed transition"
                  >
                    <i className="fa-solid fa-chevron-up text-sm"></i>
                  </button>
                  <button
                    onClick={() => movePriority(priority.id, 'down')}
                    disabled={index === priorities.length - 1}
                    className="p-1 text-fg-muted hover:text-accent disabled:opacity-30 disabled:cursor-not-allowed transition"
                  >
                    <i className="fa-solid fa-chevron-down text-sm"></i>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Algorithm Selection */}
        <div>
          <h2 className="text-xl font-bold text-fg mb-6">Stacking Algorithm</h2>
          <div className="space-y-3">
            {[
              { id: 'highest-value', name: 'Highest Value First', desc: 'Stack offers to maximize discount value' },
              { id: 'best-outcome', name: 'Best Customer Outcome', desc: 'Optimize for customer satisfaction' },
              { id: 'all', name: 'Stack All Compatible', desc: 'Allow all non-exclusive offers' },
            ].map((algo) => (
              <div
                key={algo.id}
                onClick={() => setAlgorithm(algo.id as typeof algorithm)}
                className={`p-4 rounded-xl border-2 cursor-pointer transition ${
                  algorithm === algo.id
                    ? 'border-accent bg-accent/5'
                    : 'border-border bg-surface hover:border-border/80'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 mt-0.5 ${algorithm === algo.id ? 'border-accent bg-accent' : 'border-border'}`}></div>
                  <div>
                    <p className="font-semibold text-fg text-sm">{algo.name}</p>
                    <p className="text-xs text-fg-muted">{algo.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Compatibility Matrix */}
      <div>
        <h2 className="text-xl font-bold text-fg mb-6">Stacking Compatibility Matrix</h2>
        <div className="bg-surface rounded-2xl border border-border overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface-2 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-fg-muted w-48">Offer 1</th>
                {allOffers.map((offer) => (
                  <th key={offer} className="px-3 py-3 text-center text-xs font-semibold text-fg-muted whitespace-nowrap">
                    <div className="w-16 mx-auto truncate" title={offer}>
                      {offer.split(' ')[0]}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allOffers.map((offer1) => (
                <tr key={offer1} className="border-b border-border hover:bg-surface-2 transition">
                  <td className="px-4 py-3 text-sm font-medium text-fg">{offer1}</td>
                  {allOffers.map((offer2) => {
                    const rule = compatibilityMatrix.find(
                      (r) =>
                        (r.offer1 === offer1 && r.offer2 === offer2) ||
                        (r.offer1 === offer2 && r.offer2 === offer1)
                    );
                    const compatible = offer1 === offer2 || rule?.compatible;
                    return (
                      <td key={offer2} className="px-3 py-3 text-center">
                        {offer1 === offer2 ? (
                          <span className="text-fg-muted text-xs">—</span>
                        ) : (
                          <div className={`w-6 h-6 rounded flex items-center justify-center mx-auto ${compatible ? 'bg-success/10' : 'bg-danger/10'}`}>
                            <i className={`fa-solid ${compatible ? 'fa-check text-success' : 'fa-x text-danger'} text-xs`}></i>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button className="px-6 py-2.5 bg-accent text-bg font-semibold rounded-[10px] hover:bg-accent/90 transition">
          Save Policy
        </button>
      </div>
    </div>
  );
}
