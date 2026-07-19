'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

interface Offer {
  _id: string;
  title: string;
  type: 'coupon' | 'auto_offer';
  stacking: { stacks_with: string[] | null; exclusive: boolean; priority: number };
  status: string;
}

export default function RulesPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [maxCoupons, setMaxCoupons] = useState('1');
  const [maxAutoOffers, setMaxAutoOffers] = useState('1');
  const [maxTotalDiscount, setMaxTotalDiscount] = useState('');
  const [allowCrossType, setAllowCrossType] = useState(true);
  const [exclusiveTags, setExclusiveTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [algorithm, setAlgorithm] = useState('max_savings');

  useEffect(() => {
    apiFetch('/api/offers')
      .then((data) => setOffers(data.offers || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-12"><i className="fa-solid fa-spinner fa-spin text-accent text-2xl"></i></div>;
  if (error) return <div className="bg-danger/10 border border-danger/20 rounded-xl p-6 text-danger text-center">{error}</div>;

  const activeOffers = offers.filter(o => o.status === 'active');
  const offerNames = activeOffers.map(o => o.title);

  const addTag = () => {
    if (newTag.trim() && !exclusiveTags.includes(newTag.trim())) {
      setExclusiveTags([...exclusiveTags, newTag.trim().toLowerCase()]);
      setNewTag('');
    }
  };
  const removeTag = (tag: string) => setExclusiveTags(exclusiveTags.filter(t => t !== tag));

  function isCompatible(a: Offer, b: Offer): boolean {
    if (a.stacking.exclusive || b.stacking.exclusive) return false;
    if (a.stacking.stacks_with && !a.stacking.stacks_with.includes(b.type)) return false;
    if (b.stacking.stacks_with && !b.stacking.stacks_with.includes(a.type)) return false;
    return true;
  }

  return (
    <div className="space-y-8">
      <div className="bg-surface rounded-2xl border border-border p-6">
        <h2 className="text-xl font-bold text-fg mb-6">Global Stacking Policy</h2>
        <div className="grid grid-cols-2 gap-6 mb-8">
          <div>
            <label className="block text-sm font-medium text-fg mb-2">Max Coupons per Order</label>
            <input type="number" value={maxCoupons} onChange={(e) => setMaxCoupons(e.target.value)}
              className="w-full bg-[#151821] border border-[#252836] rounded-[10px] px-3.5 py-2.5 text-fg text-sm focus:border-accent/50 outline-none transition" />
          </div>
          <div>
            <label className="block text-sm font-medium text-fg mb-2">Max Auto Offers per Order</label>
            <input type="number" value={maxAutoOffers} onChange={(e) => setMaxAutoOffers(e.target.value)}
              className="w-full bg-[#151821] border border-[#252836] rounded-[10px] px-3.5 py-2.5 text-fg text-sm focus:border-accent/50 outline-none transition" />
          </div>
          <div>
            <label className="block text-sm font-medium text-fg mb-2">Max Total Discount (₹)</label>
            <input type="number" value={maxTotalDiscount} onChange={(e) => setMaxTotalDiscount(e.target.value)} placeholder="No cap"
              className="w-full bg-[#151821] border border-[#252836] rounded-[10px] px-3.5 py-2.5 text-fg text-sm focus:border-accent/50 outline-none transition" />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-3 cursor-pointer">
              <div className={`w-11 h-6 rounded-full transition ${allowCrossType ? 'bg-accent' : 'bg-[#252836]'}`} onClick={() => setAllowCrossType(!allowCrossType)}></div>
              <span className="text-sm font-medium text-fg">Allow Cross-Type Stacking</span>
            </label>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-fg mb-3">Exclusive Tags</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {exclusiveTags.map((tag) => (
              <div key={tag} className="bg-accent/10 text-accent px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2">
                {tag}<button onClick={() => removeTag(tag)} className="hover:text-accent/70">×</button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input type="text" value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="Add tag..."
              className="flex-1 bg-[#151821] border border-[#252836] rounded-[10px] px-3.5 py-2.5 text-fg text-sm focus:border-accent/50 outline-none transition"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} />
            <button onClick={addTag} className="px-4 py-2 bg-accent/20 text-accent rounded-[10px] text-sm font-medium hover:bg-accent/30 transition">Add</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8">
        <div>
          <h2 className="text-xl font-bold text-fg mb-6">Offer Priority</h2>
          <div className="bg-surface rounded-2xl border border-border p-4 space-y-2">
            {activeOffers.length === 0 ? (
              <p className="text-fg-muted text-sm text-center py-4">No active offers</p>
            ) : activeOffers.map((offer, index) => (
              <div key={offer._id} className="flex items-center justify-between bg-surface-2 rounded-lg p-3">
                <div className="flex items-center gap-3 flex-1">
                  <span className="text-xs font-bold text-fg-muted w-5 text-center">{index + 1}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-fg">{offer.title}</p>
                    <span className={`text-xs ${offer.stacking.exclusive ? 'text-danger' : 'text-success'}`}>
                      {offer.stacking.exclusive ? 'Exclusive' : 'Stackable'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-xl font-bold text-fg mb-6">Combo Resolution Algorithm</h2>
          <div className="space-y-3">
            {[
              { id: 'max_savings', name: 'Maximum Savings', desc: 'Selects the combination that saves the customer the most' },
              { id: 'priority', name: 'Merchant Priority', desc: 'Follows priority order — higher priority offers first' },
              { id: 'first_match', name: 'First Match', desc: 'Applies the first qualifying offer found. Fastest.' },
            ].map((algo) => (
              <div key={algo.id} onClick={() => setAlgorithm(algo.id)}
                className={`p-4 rounded-xl border-2 cursor-pointer transition ${algorithm === algo.id ? 'border-accent bg-accent/5' : 'border-border bg-surface hover:border-border/80'}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 mt-0.5 ${algorithm === algo.id ? 'border-accent bg-accent' : 'border-border'}`}></div>
                  <div><p className="font-semibold text-fg text-sm">{algo.name}</p><p className="text-xs text-fg-muted">{algo.desc}</p></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {activeOffers.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-fg mb-6">Stacking Compatibility</h2>
          <div className="bg-surface rounded-2xl border border-border overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-2 border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-fg-muted"></th>
                  {offerNames.map((name) => (
                    <th key={name} className="px-3 py-3 text-center text-xs font-semibold text-fg-muted whitespace-nowrap">
                      <div className="w-20 mx-auto truncate" title={name}>{name.split(' ').slice(0, 2).join(' ')}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeOffers.map((offerA) => (
                  <tr key={offerA._id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-sm font-medium text-fg truncate max-w-[180px]">{offerA.title}</td>
                    {activeOffers.map((offerB) => {
                      if (offerA._id === offerB._id) {
                        return <td key={offerB._id} className="px-3 py-3 text-center"><span className="text-fg-muted text-xs">—</span></td>;
                      }
                      const compatible = isCompatible(offerA, offerB);
                      return (
                        <td key={offerB._id} className="px-3 py-3 text-center">
                          <div className={`w-6 h-6 rounded flex items-center justify-center mx-auto ${compatible ? 'bg-success/10' : 'bg-danger/10'}`}>
                            <i className={`fa-solid ${compatible ? 'fa-check text-success' : 'fa-xmark text-danger'} text-xs`}></i>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button className="px-6 py-2.5 bg-accent text-bg font-semibold rounded-[10px] hover:bg-accent/90 transition">Save Policy</button>
      </div>
    </div>
  );
}
