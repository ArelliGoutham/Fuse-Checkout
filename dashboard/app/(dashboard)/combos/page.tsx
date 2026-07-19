'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

interface Product {
  _id: string;
  sku_id: string;
  name: string;
  category?: string;
  brand?: string;
}

interface Combo {
  _id: string;
  name: string;
  product_skus: string[];
}

export default function CombosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [comboName, setComboName] = useState('');
  const [selectedSkus, setSelectedSkus] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      apiFetch('/api/products').catch(() => ({ products: [] })),
      apiFetch('/api/product-combos').catch(() => ({ combos: [] })),
    ])
      .then(([prodRes, comboRes]) => {
        setProducts(prodRes.products || []);
        setCombos(comboRes.combos || []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-12"><i className="fa-solid fa-spinner fa-spin text-accent text-2xl"></i></div>;

  const toggleSku = (sku: string) => {
    setSelectedSkus(prev => prev.includes(sku) ? prev.filter(s => s !== sku) : [...prev, sku]);
  };

  const createCombo = async () => {
    if (!comboName || selectedSkus.length < 2) return;
    try {
      await apiFetch('/api/product-combos', {
        method: 'POST',
        body: JSON.stringify({ name: comboName, product_skus: selectedSkus }),
      });
      setCombos([...combos, { _id: Date.now().toString(), name: comboName, product_skus: selectedSkus }]);
      setComboName('');
      setSelectedSkus([]);
      setShowCreate(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create combo');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-fg">Product Combos</h1>
          <p className="text-sm text-fg-muted mt-1">Define bundles for product_combo rules</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="px-4 py-2 bg-accent text-bg rounded-[10px] text-sm font-semibold hover:bg-accent/90 transition flex items-center gap-2">
          <i className="fa-solid fa-plus text-sm"></i>Create Combo
        </button>
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 text-danger text-sm">
          <i className="fa-solid fa-circle-exclamation mr-2"></i>{error}
        </div>
      )}

      {showCreate && (
        <div className="bg-surface rounded-2xl border border-border p-6 space-y-4">
          <h2 className="text-lg font-bold text-fg">New Combo</h2>
          <div>
            <label className="block text-sm font-medium text-fg mb-2">Combo Name</label>
            <input type="text" value={comboName} onChange={(e) => setComboName(e.target.value)} placeholder="e.g., iPhone + Case Bundle"
              className="w-full bg-[#151821] border border-[#252836] rounded-[10px] px-3.5 py-2.5 text-fg text-sm focus:border-accent/50 outline-none transition" />
          </div>
          <div>
            <label className="block text-sm font-medium text-fg mb-2">Select Products (min 2)</label>
            <div className="flex flex-wrap gap-2">
              {products.map((p) => (
                <button key={p._id} onClick={() => toggleSku(p.sku_id)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition ${selectedSkus.includes(p.sku_id) ? 'bg-accent text-bg' : 'bg-surface-2 text-fg-soft hover:text-fg border border-border'}`}>
                  {selectedSkus.includes(p.sku_id) && <i className="fa-solid fa-check mr-1"></i>}
                  {p.sku_id} — {p.name}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={createCombo} disabled={!comboName || selectedSkus.length < 2}
              className="px-6 py-2 bg-accent text-bg rounded-lg font-semibold text-sm disabled:opacity-50">Create</button>
            <button onClick={() => setShowCreate(false)} className="px-6 py-2 bg-surface-2 text-fg rounded-lg font-medium text-sm border border-border">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {combos.length === 0 ? (
          <div className="col-span-2 bg-surface rounded-2xl border border-border p-12 text-center">
            <i className="fa-solid fa-cubes text-4xl text-fg-muted/30 mb-4 block"></i>
            <p className="text-fg-muted text-sm">No combos yet. Create one to use in product_combo rules.</p>
          </div>
        ) : combos.map((combo) => (
          <div key={combo._id} className="bg-surface rounded-2xl border border-border p-6 hover:border-border/80 transition">
            <h3 className="text-lg font-bold text-fg mb-4">{combo.name}</h3>
            <div className="pt-4 border-t border-border">
              <p className="text-xs text-fg-muted mb-2 font-medium">Products ({combo.product_skus.length})</p>
              <div className="flex flex-wrap gap-2">
                {combo.product_skus.map((sku) => (
                  <span key={sku} className="px-2.5 py-1 bg-accent/10 text-accent rounded-lg text-xs font-mono font-medium">{sku}</span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
