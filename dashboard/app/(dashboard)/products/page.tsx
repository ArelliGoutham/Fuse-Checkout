'use client';

import { useState } from 'react';

interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  brand: string;
  status: 'active' | 'inactive' | 'draft';
}

const products: Product[] = [
  {
    id: '1',
    sku: 'TSHIRT-001',
    name: 'Classic White T-Shirt',
    category: 'Apparel',
    brand: 'OfferForge Brand',
    status: 'active',
  },
  {
    id: '2',
    sku: 'HOODIE-001',
    name: 'Premium Hoodie',
    category: 'Apparel',
    brand: 'OfferForge Brand',
    status: 'active',
  },
  {
    id: '3',
    sku: 'SHOES-001',
    name: 'Running Shoes',
    category: 'Footwear',
    brand: 'SportGear',
    status: 'active',
  },
  {
    id: '4',
    sku: 'SHOES-002',
    name: 'Casual Sneakers',
    category: 'Footwear',
    brand: 'CasualWear',
    status: 'inactive',
  },
  {
    id: '5',
    sku: 'CAP-001',
    name: 'Baseball Cap',
    category: 'Accessories',
    brand: 'OfferForge Brand',
    status: 'active',
  },
  {
    id: '6',
    sku: 'JACKET-001',
    name: 'Winter Jacket',
    category: 'Outerwear',
    brand: 'ColdWeather',
    status: 'draft',
  },
  {
    id: '7',
    sku: 'JEANS-001',
    name: 'Blue Denim Jeans',
    category: 'Apparel',
    brand: 'DenimPro',
    status: 'active',
  },
  {
    id: '8',
    sku: 'SOCKS-001',
    name: 'Athletic Socks Pack',
    category: 'Accessories',
    brand: 'OfferForge Brand',
    status: 'active',
  },
];

export default function ProductsPage() {
  const [sortBy, setSortBy] = useState<'name' | 'sku' | 'status'>('name');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive' | 'draft'>('all');

  const sortedProducts = [...products].sort((a, b) => {
    if (sortBy === 'sku') return a.sku.localeCompare(b.sku);
    if (sortBy === 'status') return a.status.localeCompare(b.status);
    return a.name.localeCompare(b.name);
  });

  const filteredProducts = filterStatus === 'all' ? sortedProducts : sortedProducts.filter((p) => p.status === filterStatus);

  const getStatusBadge = (status: Product['status']) => {
    const styles = {
      active: { bg: 'bg-success/10', text: 'text-success', label: 'Active' },
      inactive: { bg: 'bg-danger/10', text: 'text-danger', label: 'Inactive' },
      draft: { bg: 'bg-fg-muted/10', text: 'text-fg-muted', label: 'Draft' },
    };
    const style = styles[status];
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${style.bg === 'bg-success/10' ? 'bg-success' : style.bg === 'bg-danger/10' ? 'bg-danger' : 'bg-fg-muted'}`}></span>
        {style.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-fg">Products</h1>
          <p className="text-sm text-fg-muted mt-1">Manage your product catalog</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 border border-border bg-surface rounded-[10px] text-fg text-sm font-medium hover:bg-surface-2 transition flex items-center gap-2">
            <i className="fa-solid fa-arrow-up-from-bracket text-accent"></i>
            Bulk Import
          </button>
          <button className="px-4 py-2 bg-accent text-bg rounded-[10px] text-sm font-semibold hover:bg-accent/90 transition flex items-center gap-2">
            <i className="fa-solid fa-plus text-sm"></i>
            Add Product
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-surface rounded-2xl border border-border p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <label className="text-xs font-medium text-fg-muted mr-2">Filter:</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
              className="px-3 py-1.5 bg-[#151821] border border-[#252836] rounded-lg text-fg text-sm focus:border-accent/50 outline-none transition"
            >
              <option value="all">All Products</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="draft">Draft</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-fg-muted mr-2">Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="px-3 py-1.5 bg-[#151821] border border-[#252836] rounded-lg text-fg text-sm focus:border-accent/50 outline-none transition"
            >
              <option value="name">Name</option>
              <option value="sku">SKU</option>
              <option value="status">Status</option>
            </select>
          </div>
        </div>
        <p className="text-xs text-fg-muted">{filteredProducts.length} products</p>
      </div>

      {/* Products Table */}
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
            {filteredProducts.map((product, index) => (
              <tr key={product.id} className={`border-b border-border hover:bg-surface-2 transition ${index === filteredProducts.length - 1 ? 'border-b-0' : ''}`}>
                <td className="px-6 py-4 text-sm font-mono text-fg-muted">{product.sku}</td>
                <td className="px-6 py-4 text-sm font-medium text-fg">{product.name}</td>
                <td className="px-6 py-4 text-sm text-fg-muted">{product.category}</td>
                <td className="px-6 py-4 text-sm text-fg-muted">{product.brand}</td>
                <td className="px-6 py-4">{getStatusBadge(product.status)}</td>
                <td className="px-6 py-4 text-center">
                  <div className="flex items-center justify-center gap-3">
                    <button className="text-fg-muted hover:text-accent transition" title="Edit">
                      <i className="fa-solid fa-pen-to-square text-sm"></i>
                    </button>
                    <button className="text-fg-muted hover:text-danger transition" title="Delete">
                      <i className="fa-solid fa-trash text-sm"></i>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
