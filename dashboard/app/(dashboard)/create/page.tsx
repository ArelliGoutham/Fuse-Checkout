'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

const RULE_TYPES: { label: string; value: string }[] = [
  { label: 'Minimum Cart Value', value: 'min_cart_value' },
  { label: 'Maximum Cart Value', value: 'max_cart_value' },
  { label: 'Customer Segment', value: 'customer_segment' },
  { label: 'First Time Buyer', value: 'first_time_buyer' },
  { label: 'Category Restriction', value: 'category_restriction' },
  { label: 'Product Restriction', value: 'product_restriction' },
  { label: 'Brand Restriction', value: 'brand_restriction' },
  { label: 'Product Combo', value: 'product_combo' },
  { label: 'Time Window', value: 'time_window' },
  { label: 'Weekend Only', value: 'weekend_only' },
  { label: 'Date Range', value: 'date_range' },
];

export default function CreateOfferPage() {
  const router = useRouter();
  const [offerType, setOfferType] = useState<'coupon' | 'auto_offer' | null>(null);
  const [discountType, setDiscountType] = useState<'flat' | 'percentage'>('flat');
  const [selectedRules, setSelectedRules] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    code: '',
    validFrom: '',
    validUntil: '',
    discountValue: '',
    maxCap: '',
    minCart: '',
    usageLimit: '',
    perCustomerLimit: '',
    exclusive: false,
  });

  const generateCode = () => {
    const code = 'SAVE' + Math.floor(Math.random() * 90 + 10);
    setFormData({ ...formData, code });
  };

  const toggleRule = (rule: string) => {
    setSelectedRules(prev => prev.includes(rule) ? prev.filter(r => r !== rule) : [...prev, rule]);
  };

  const handleSubmit = async () => {
    setError(null);
    if (!formData.title || !formData.validFrom || !formData.validUntil || !formData.discountValue) {
      setError('Please fill in title, dates, and discount value');
      return;
    }

    setSubmitting(true);
    try {
      const rules: { rule_type: string; config: Record<string, unknown> }[] = [];

      if (formData.minCart) {
        rules.push({ rule_type: 'min_cart_value', config: { min_amount: Number(formData.minCart) } });
      }
      for (const ruleType of selectedRules) {
        if (ruleType === 'first_time_buyer') {
          rules.push({ rule_type: 'first_time_buyer', config: {} });
        } else if (ruleType === 'weekend_only') {
          rules.push({ rule_type: 'weekend_only', config: {} });
        } else {
          rules.push({ rule_type: ruleType, config: {} });
        }
      }

      const body = {
        code: offerType === 'coupon' ? formData.code : null,
        type: offerType,
        title: formData.title,
        discount: {
          type: discountType,
          value: Number(formData.discountValue),
          max_discount: formData.maxCap ? Number(formData.maxCap) : null,
        },
        validity: {
          starts_at: new Date(formData.validFrom).toISOString(),
          ends_at: new Date(formData.validUntil).toISOString(),
        },
        usage_limits: {
          total: null,
          per_customer: formData.perCustomerLimit ? Number(formData.perCustomerLimit) : null,
        },
        rules,
        stacking: {
          stacks_with: null,
          exclusive: formData.exclusive,
          priority: 0,
        },
      };

      await apiFetch('/api/offers', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create offer');
    } finally {
      setSubmitting(false);
    }
  };

  if (!offerType) {
    return (
      <div className="max-w-4xl">
        <h1 className="text-3xl font-bold text-fg mb-2">Create New Offer</h1>
        <p className="text-fg-muted mb-8">Choose the type of offer you want to create</p>

        <div className="grid grid-cols-2 gap-6">
          <button
            onClick={() => setOfferType('coupon')}
            className="bg-surface rounded-2xl border-2 border-border hover:border-accent p-8 text-left transition group"
          >
            <div className="w-16 h-16 bg-info/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-info/20 transition">
              <i className="fa-solid fa-tag text-info text-3xl"></i>
            </div>
            <h2 className="text-xl font-bold text-fg mb-2">Coupon Code</h2>
            <p className="text-fg-muted text-sm">Customers enter a code at checkout. Great for promotions and seasonal campaigns.</p>
          </button>

          <button
            onClick={() => setOfferType('auto_offer')}
            className="bg-surface rounded-2xl border-2 border-border hover:border-accent p-8 text-left transition group"
          >
            <div className="w-16 h-16 bg-accent/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-accent/20 transition">
              <i className="fa-solid fa-bolt text-accent text-3xl"></i>
            </div>
            <h2 className="text-xl font-bold text-fg mb-2">Auto-Applied Offer</h2>
            <p className="text-fg-muted text-sm">Automatically applied based on cart conditions. No code needed.</p>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => setOfferType(null)} className="text-fg-soft hover:text-fg transition">
          <i className="fa-solid fa-arrow-left"></i>
        </button>
        <h1 className="text-3xl font-bold text-fg">
          Create {offerType === 'coupon' ? 'Coupon' : 'Auto-Applied'} Offer
        </h1>
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 text-danger text-sm mb-6">
          <i className="fa-solid fa-circle-exclamation mr-2"></i>{error}
        </div>
      )}

      <div className="space-y-6">
        {/* Basic Details */}
        <div className="bg-surface rounded-2xl border border-border p-8">
          <h2 className="text-lg font-bold text-fg mb-6">Basic Details</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-fg mb-2">Offer Title</label>
              <input
                type="text"
                placeholder="e.g., Flat ₹50 off on orders above ₹500"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full bg-[#151821] border border-[#252836] rounded-[10px] px-3.5 py-2.5 text-fg text-sm focus:border-accent/50 outline-none transition"
              />
            </div>

            {offerType === 'coupon' && (
              <div>
                <label className="block text-sm font-medium text-fg mb-2">Coupon Code</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="FLAT50"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="flex-1 bg-[#151821] border border-[#252836] rounded-[10px] px-3.5 py-2.5 text-fg text-sm font-mono focus:border-accent/50 outline-none transition uppercase"
                  />
                  <button
                    onClick={generateCode}
                    className="bg-surface-2 hover:bg-surface-3 border border-border text-fg-soft hover:text-fg px-4 py-2.5 rounded-[10px] transition text-sm font-medium"
                  >
                    <i className="fa-solid fa-dice"></i> Generate
                  </button>
                </div>
              </div>
            )}

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
                  discountType === 'flat' ? 'bg-accent text-bg' : 'bg-surface-2 text-fg-soft hover:text-fg'
                }`}
              >
                Flat Discount (₹)
              </button>
              <button
                onClick={() => setDiscountType('percentage')}
                className={`flex-1 py-3 px-4 rounded-lg font-medium transition ${
                  discountType === 'percentage' ? 'bg-accent text-bg' : 'bg-surface-2 text-fg-soft hover:text-fg'
                }`}
              >
                Percentage Discount (%)
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-fg mb-2">
                  {discountType === 'flat' ? 'Discount Amount (₹)' : 'Discount Percentage (%)'}
                </label>
                <input
                  type="number"
                  placeholder={discountType === 'flat' ? '50' : '10'}
                  value={formData.discountValue}
                  onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                  className="w-full bg-[#151821] border border-[#252836] rounded-[10px] px-3.5 py-2.5 text-fg text-sm focus:border-accent/50 outline-none transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-fg mb-2">Maximum Discount Cap (₹)</label>
                <input
                  type="number"
                  placeholder="Optional — for percentage caps"
                  value={formData.maxCap}
                  onChange={(e) => setFormData({ ...formData, maxCap: e.target.value })}
                  className="w-full bg-[#151821] border border-[#252836] rounded-[10px] px-3.5 py-2.5 text-fg text-sm focus:border-accent/50 outline-none transition"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Rules & Restrictions */}
        <div className="bg-surface rounded-2xl border border-border p-8">
          <h2 className="text-lg font-bold text-fg mb-2">Rules & Restrictions</h2>
          <p className="text-fg-muted text-sm mb-6">Add conditions that must be met for the offer to apply</p>

          <div className="mb-4">
            <label className="block text-sm font-medium text-fg mb-2">Minimum Cart Value (₹)</label>
            <input
              type="number"
              placeholder="e.g., 500"
              value={formData.minCart}
              onChange={(e) => setFormData({ ...formData, minCart: e.target.value })}
              className="w-full bg-[#151821] border border-[#252836] rounded-[10px] px-3.5 py-2.5 text-fg text-sm focus:border-accent/50 outline-none transition"
            />
          </div>

          <label className="block text-sm font-medium text-fg mb-3">Additional Rules</label>
          <div className="flex flex-wrap gap-2">
            {RULE_TYPES.map((rule) => (
              <button
                key={rule.value}
                onClick={() => toggleRule(rule.value)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition ${
                  selectedRules.includes(rule.value)
                    ? 'bg-accent text-bg' : 'bg-surface-2 text-fg-soft hover:text-fg border border-border'
                }`}
              >
                {selectedRules.includes(rule.value) && <i className="fa-solid fa-check mr-1"></i>}
                {rule.label}
              </button>
            ))}
          </div>
        </div>

        {/* Stacking & Limits */}
        <div className="bg-surface rounded-2xl border border-border p-8">
          <h2 className="text-lg font-bold text-fg mb-6">Stacking & Usage Limits</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-fg mb-2">Per-Customer Usage Limit</label>
              <input
                type="number"
                placeholder="Leave empty for unlimited"
                value={formData.perCustomerLimit}
                onChange={(e) => setFormData({ ...formData, perCustomerLimit: e.target.value })}
                className="w-full bg-[#151821] border border-[#252836] rounded-[10px] px-3.5 py-2.5 text-fg text-sm focus:border-accent/50 outline-none transition"
              />
            </div>

            <div className="flex items-center gap-3 p-3 bg-surface-2 rounded-lg">
              <input
                type="checkbox"
                id="exclusive"
                checked={formData.exclusive}
                onChange={(e) => setFormData({ ...formData, exclusive: e.target.checked })}
                className="w-4 h-4 accent-amber-500"
              />
              <label htmlFor="exclusive" className="text-fg text-sm cursor-pointer">
                Exclusive offer — cannot stack with other offers
              </label>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 bg-accent hover:bg-accent-hover text-bg font-semibold py-3 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <><i className="fa-solid fa-spinner fa-spin"></i> Creating...</>
            ) : (
              'Create Offer'
            )}
          </button>
          <button
            onClick={() => router.push('/')}
            className="px-6 bg-surface-2 hover:bg-surface-3 text-fg font-semibold py-3 rounded-lg transition border border-border"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
