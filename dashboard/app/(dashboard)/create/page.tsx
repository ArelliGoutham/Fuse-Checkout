'use client';

import { useState } from 'react';

const RULE_TYPES = [
  'Min Cart Value',
  'Max Cart Value',
  'Min Quantity',
  'Max Quantity',
  'Category Restriction',
  'Brand Restriction',
  'Customer Type',
  'First Time Only',
  'Exclude Products',
  'Include Products',
  'Geographic Restriction',
  'Usage Limit Per Customer',
  'Custom Condition',
];

export default function CreateOfferPage() {
  const [offerType, setOfferType] = useState<'coupon' | 'auto' | null>(null);
  const [discountType, setDiscountType] = useState<'flat' | 'percentage'>('percentage');
  const [rules, setRules] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    code: '',
    validFrom: '',
    validUntil: '',
    discountValue: '',
    maxCap: '',
    minCart: '',
    usageLimit: '',
    exclusive: false,
  });

  const generateCode = () => {
    const code = 'OFF' + Math.random().toString(36).substring(2, 8).toUpperCase();
    setFormData({ ...formData, code });
  };

  const addRule = (ruleType: string) => {
    if (!rules.includes(ruleType)) {
      setRules([...rules, ruleType]);
    }
  };

  const removeRule = (ruleType: string) => {
    setRules(rules.filter((r) => r !== ruleType));
  };

  if (!offerType) {
    return (
      <div className="max-w-4xl">
        <h1 className="text-3xl font-bold text-fg mb-2">Create New Offer</h1>
        <p className="text-fg-muted mb-8">Choose the type of offer you want to create</p>

        <div className="grid grid-cols-2 gap-6">
          {/* Coupon Code Card */}
          <button
            onClick={() => setOfferType('coupon')}
            className="bg-surface rounded-2xl border-2 border-border hover:border-accent p-8 text-left transition group"
          >
            <div className="w-16 h-16 bg-info/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-info/20 transition">
              <i className="fa-solid fa-ticket text-info text-3xl"></i>
            </div>
            <h2 className="text-xl font-bold text-fg mb-2">Coupon Code</h2>
            <p className="text-fg-muted text-sm">Customers enter a code at checkout. Great for promotions and seasonal campaigns.</p>
          </button>

          {/* Auto-Applied Card */}
          <button
            onClick={() => setOfferType('auto')}
            className="bg-surface rounded-2xl border-2 border-border hover:border-accent p-8 text-left transition group"
          >
            <div className="w-16 h-16 bg-accent/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-accent/20 transition">
              <i className="fa-solid fa-gift text-accent text-3xl"></i>
            </div>
            <h2 className="text-xl font-bold text-fg mb-2">Auto-Applied Offer</h2>
            <p className="text-fg-muted text-sm">Automatically applied based on cart conditions. Perfect for targeted incentives.</p>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => setOfferType(null)}
          className="text-fg-soft hover:text-fg transition"
        >
          <i className="fa-solid fa-arrow-left"></i>
        </button>
        <h1 className="text-3xl font-bold text-fg">
          Create {offerType === 'coupon' ? 'Coupon Code' : 'Auto-Applied'} Offer
        </h1>
      </div>

      <div className="space-y-6">
        {/* Basic Details */}
        <div className="bg-surface rounded-2xl border border-border p-8">
          <h2 className="text-lg font-bold text-fg mb-6">Basic Details</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-fg mb-2">Offer Title</label>
              <input
                type="text"
                placeholder="e.g., Summer Sale 2024"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full bg-[#151821] border border-[#252836] rounded-[10px] px-3.5 py-2.5 text-fg text-sm focus:border-accent/50 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-fg mb-2">Offer Code</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="SUMMER20"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="flex-1 bg-[#151821] border border-[#252836] rounded-[10px] px-3.5 py-2.5 text-fg text-sm focus:border-accent/50 outline-none transition"
                />
                <button
                  onClick={generateCode}
                  className="bg-surface-2 hover:bg-surface-3 border border-border text-fg-soft hover:text-fg px-4 py-2.5 rounded-[10px] transition text-sm font-medium"
                >
                  <i className="fa-solid fa-dice"></i> Generate
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-fg mb-2">Valid From</label>
                <input
                  type="date"
                  value={formData.validFrom}
                  onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                  className="w-full bg-[#151821] border border-[#252836] rounded-[10px] px-3.5 py-2.5 text-fg text-sm focus:border-accent/50 outline-none transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-fg mb-2">Valid Until</label>
                <input
                  type="date"
                  value={formData.validUntil}
                  onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                  className="w-full bg-[#151821] border border-[#252836] rounded-[10px] px-3.5 py-2.5 text-fg text-sm focus:border-accent/50 outline-none transition"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Discount Configuration */}
        <div className="bg-surface rounded-2xl border border-border p-8">
          <h2 className="text-lg font-bold text-fg mb-6">Discount Configuration</h2>
          <div className="space-y-4">
            <div className="flex gap-4 mb-6">
              <button
                onClick={() => setDiscountType('flat')}
                className={`flex-1 py-3 px-4 rounded-lg font-medium transition ${
                  discountType === 'flat'
                    ? 'bg-accent text-bg'
                    : 'bg-surface-2 text-fg-soft hover:text-fg'
                }`}
              >
                Flat Discount
              </button>
              <button
                onClick={() => setDiscountType('percentage')}
                className={`flex-1 py-3 px-4 rounded-lg font-medium transition ${
                  discountType === 'percentage'
                    ? 'bg-accent text-bg'
                    : 'bg-surface-2 text-fg-soft hover:text-fg'
                }`}
              >
                Percentage Discount
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-fg mb-2">
                  {discountType === 'flat' ? 'Discount Amount ($)' : 'Discount Percentage (%)'}
                </label>
                <input
                  type="number"
                  placeholder="20"
                  value={formData.discountValue}
                  onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                  className="w-full bg-[#151821] border border-[#252836] rounded-[10px] px-3.5 py-2.5 text-fg text-sm focus:border-accent/50 outline-none transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-fg mb-2">Maximum Discount Cap ($)</label>
                <input
                  type="number"
                  placeholder="100"
                  value={formData.maxCap}
                  onChange={(e) => setFormData({ ...formData, maxCap: e.target.value })}
                  className="w-full bg-[#151821] border border-[#252836] rounded-[10px] px-3.5 py-2.5 text-fg text-sm focus:border-accent/50 outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-fg mb-2">Minimum Cart Value ($)</label>
              <input
                type="number"
                placeholder="50"
                value={formData.minCart}
                onChange={(e) => setFormData({ ...formData, minCart: e.target.value })}
                className="w-full bg-[#151821] border border-[#252836] rounded-[10px] px-3.5 py-2.5 text-fg text-sm focus:border-accent/50 outline-none transition"
              />
            </div>
          </div>
        </div>

        {/* Rules & Restrictions */}
        <div className="bg-surface rounded-2xl border border-border p-8">
          <h2 className="text-lg font-bold text-fg mb-6">Rules & Restrictions</h2>
          <div>
            <label className="block text-sm font-medium text-fg mb-3">Add Rules</label>
            <div className="grid grid-cols-2 gap-2 mb-6">
              {RULE_TYPES.map((ruleType) => (
                <button
                  key={ruleType}
                  onClick={() => addRule(ruleType)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                    rules.includes(ruleType)
                      ? 'bg-accent text-bg'
                      : 'bg-surface-2 text-fg-soft hover:text-fg'
                  }`}
                >
                  {ruleType}
                </button>
              ))}
            </div>

            {rules.length > 0 && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-fg">Selected Rules</label>
                {rules.map((rule) => (
                  <div key={rule} className="flex items-center justify-between bg-surface-2 rounded-lg p-3">
                    <span className="text-fg">{rule}</span>
                    <button
                      onClick={() => removeRule(rule)}
                      className="text-danger hover:text-danger/80 transition"
                    >
                      <i className="fa-solid fa-trash text-sm"></i>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Stacking & Limits */}
        <div className="bg-surface rounded-2xl border border-border p-8">
          <h2 className="text-lg font-bold text-fg mb-6">Stacking & Limits</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-fg mb-2">Usage Limit Per Customer</label>
              <input
                type="number"
                placeholder="1"
                value={formData.usageLimit}
                onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value })}
                className="w-full bg-[#151821] border border-[#252836] rounded-[10px] px-3.5 py-2.5 text-fg text-sm focus:border-accent/50 outline-none transition"
              />
            </div>

            <div className="flex items-center gap-3 p-3 bg-surface-2 rounded-lg">
              <input
                type="checkbox"
                id="exclusive"
                checked={formData.exclusive}
                onChange={(e) => setFormData({ ...formData, exclusive: e.target.checked })}
                className="w-4 h-4"
              />
              <label htmlFor="exclusive" className="text-fg text-sm font-medium cursor-pointer">
                This offer cannot be stacked with other coupons
              </label>
            </div>

            <div className="flex flex-wrap gap-2 p-3 bg-surface-2 rounded-lg">
              <span className="text-fg-soft text-sm">Stacks with:</span>
              {['Shipping', 'Auto-Applied', 'Category'].map((tag) => (
                <span key={tag} className="text-xs bg-surface rounded px-2 py-1 text-fg-soft">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Create Button */}
        <div className="flex gap-3">
          <button className="flex-1 bg-accent hover:bg-accent-hover text-bg font-semibold py-3 rounded-lg transition">
            Create Offer
          </button>
          <button className="px-6 bg-surface-2 hover:bg-surface-3 text-fg font-semibold py-3 rounded-lg transition border border-border">
            Save as Draft
          </button>
        </div>
      </div>
    </div>
  );
}
