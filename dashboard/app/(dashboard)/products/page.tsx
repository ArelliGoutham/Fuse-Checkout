'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

interface Product {
  _id: string;
  sku_id: string;
  name: string;
  category?: string;
  brand?: string;
  status: string;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch('/api/products')
      .then((data) => { setProducts(data.products || []); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-12"><i className="fa-solid fa-spinner fa-spin text-accent text-2xl"></i></div>;
  if (error) return <div className="bg-danger/10 border border-danger/20 rounded-xl p-6 text-danger text-center">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-fg">Products</h1>
          <p className="text-sm text-fg-muted mt-1">Manage your product catalog</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 border border-border bg-surface rounded-[10px] text-fg text-sm font-medium hover:bg-surface-2 transition flex items-center gap-2">
            <i className="fa-solid fa-arrow-up-from-bracket text-accent"></i>Bulk Import
          </button>
          <button className="px-4 py-2 bg-accent text-bg rounded-[10px] text-sm font-semibold hover:bg-accent/90 transition flex items-center gap-2">
            <i className="fa-solid fa-plus text-sm"></i>Add Product
          </button>
        </div>
      </div>

      <div className="bg-surface rounded-2xl border border-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-surface-2 border-b border-border">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-semibold text-fg-muted">SKU</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-fg-muted">Product Name</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-fg-muted">Category</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-fg-muted">Brand</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-fg-muted">Status</th>
              <th className="text-center px-6 py-3 text-xs font-semibold text-fg-muted">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-fg-muted">No products yet</td></tr>
            ) : products.map((product) => (
              <tr key={product._id} className="border-b border-border hover:bg-surface-2 transition last:border-0">
                <td className="px-6 py-4 text-sm font-mono text-fg-muted">{product.sku_id}</td>
                <td className="px-6 py-4 text-sm font-medium text-fg">{product.name}</td>
                <td className="px-6 py-4 text-sm text-fg-muted">{product.category || '—'}</td>
                <td className="px-6 py-4 text-sm text-fg-muted">{product.brand || '—'}</td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-success/10 text-success">
                    <span className="w-1.5 h-1.5 rounded-full bg-success"></span>{product.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  <button className="text-fg-muted hover:text-accent transition mr-3"><i className="fa-solid fa-pen-to-square text-sm"></i></button>
                  <button className="text-fg-muted hover:text-danger transition"><i className="fa-solid fa-trash text-sm"></i></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
