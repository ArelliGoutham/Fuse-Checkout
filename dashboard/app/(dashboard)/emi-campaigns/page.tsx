'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

interface Campaign {
  _id: string;
  code: string;
  title: string;
  scope: string;
  bank: string;
  emi_type: string;
  status: string;
  starts_at: string;
  ends_at: string;
  requires_imei: boolean;
}

interface IINRange {
  _id: string;
  prefix: string;
  bank_code: string;
  bank_name: string;
  card_type: string;
  card_tier: string;
  card_network: string;
  status: string;
}

export default function EMICampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [iinRanges, setIinRanges] = useState<IINRange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [showIinModal, setShowIinModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [campaignForm, setCampaignForm] = useState({
    code: '', title: '', scope: 'merchant', bank: '',
    iin_prefixes: '', card_tiers: '', emi_type: 'no_cost',
    products: '', max_total: '100', max_per_card: '2',
    requires_imei: false, starts_at: '', ends_at: '',
  });

  const [iinForm, setIinForm] = useState({
    prefix: '', bank_code: '', bank_name: '',
    card_type: 'credit', card_tier: 'platinum', card_network: 'visa',
  });

  useEffect(() => { loadData(); }, []);

  const loadData = () => {
    Promise.all([
      apiFetch('/api/admin/emi-campaigns'),
      apiFetch('/api/admin/iin-ranges'),
    ])
      .then(([campData, iinData]) => {
        setCampaigns(campData.campaigns || []);
        setIinRanges(iinData.iin_ranges || []);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  const handleCreateCampaign = async () => {
    setActionLoading(true);
    try {
      await apiFetch('/api/admin/emi-campaigns', {
        method: 'POST',
        body: JSON.stringify({
          code: campaignForm.code,
          title: campaignForm.title,
          scope: campaignForm.scope,
          merchant_id: campaignForm.scope === 'merchant' ? 'merch_demo' : null,
          brand: campaignForm.scope === 'brand' ? campaignForm.bank : null,
          bank: campaignForm.bank,
          iin_prefixes: campaignForm.iin_prefixes.split(',').map(s => s.trim()).filter(Boolean),
          card_tiers: campaignForm.card_tiers.split(',').map(s => s.trim()).filter(Boolean),
          emi_type: campaignForm.emi_type,
          products: campaignForm.products ? campaignForm.products.split(',').map(s => s.trim()) : null,
          max_total: parseInt(campaignForm.max_total),
          max_per_card: parseInt(campaignForm.max_per_card),
          requires_imei: campaignForm.requires_imei,
          starts_at: campaignForm.starts_at ? new Date(campaignForm.starts_at).toISOString() : new Date().toISOString(),
          ends_at: campaignForm.ends_at ? new Date(campaignForm.ends_at).toISOString() : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      });
      setShowCampaignModal(false);
      setCampaignForm({ code: '', title: '', scope: 'merchant', bank: '', iin_prefixes: '', card_tiers: '', emi_type: 'no_cost', products: '', max_total: '100', max_per_card: '2', requires_imei: false, starts_at: '', ends_at: '' });
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create campaign');
    }
    setActionLoading(false);
  };

  const handleCreateIIN = async () => {
    setActionLoading(true);
    try {
      await apiFetch('/api/admin/iin-ranges', {
        method: 'POST',
        body: JSON.stringify(iinForm),
      });
      setShowIinModal(false);
      setIinForm({ prefix: '', bank_code: '', bank_name: '', card_type: 'credit', card_tier: 'platinum', card_network: 'visa' });
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create IIN range');
    }
    setActionLoading(false);
  };

  if (loading) {
    return <div className="flex justify-center py-12"><i className="fa-solid fa-spinner fa-spin text-accent text-2xl"></i></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-fg">EMI Campaigns</h2>
        <p className="text-fg-muted text-sm mt-1">Manage no-cost and low-cost EMI campaigns across card BINs</p>
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 text-danger text-sm">{error}</div>
      )}

      {/* Campaigns Section */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-fg">Active Campaigns</h3>
          <button onClick={() => setShowCampaignModal(true)}
            className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-bg font-semibold px-4 py-2 rounded-lg transition text-sm">
            <i className="fa-solid fa-plus text-xs"></i> Create Campaign
          </button>
        </div>

        {campaigns.length === 0 ? (
          <div className="text-center py-8 text-fg-muted text-sm">No campaigns configured</div>
        ) : (
          <div className="space-y-3">
            {campaigns.map(c => (
              <div key={c._id} className="flex items-center justify-between p-4 bg-surface-2 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
                    <i className="fa-solid fa-percent text-accent"></i>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-fg">{c.title}</div>
                    <div className="text-xs text-fg-muted flex items-center gap-2">
                      <span>{c.code}</span>
                      <span>·</span>
                      <span className="capitalize">{c.scope}</span>
                      <span>·</span>
                      <span className="capitalize">{c.emi_type.replace('_', '-')}</span>
                      {c.requires_imei && <span className="text-info">· Requires IMEI</span>}
                    </div>
                  </div>
                </div>
                <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${c.status === 'active' ? 'bg-success/10 text-success' : 'bg-fg-muted/10 text-fg-muted'}`}>
                  {c.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* IIN Ranges Section */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-fg">IIN Ranges ({iinRanges.length})</h3>
          <button onClick={() => setShowIinModal(true)}
            className="flex items-center gap-2 bg-surface-2 border border-border hover:bg-surface-3 text-fg font-semibold px-4 py-2 rounded-lg transition text-sm">
            <i className="fa-solid fa-plus text-xs"></i> Add IIN
          </button>
        </div>

        <div className="overflow-hidden rounded-lg">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-3 py-2 text-xs font-semibold text-fg-muted uppercase">Prefix</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-fg-muted uppercase">Bank</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-fg-muted uppercase">Type</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-fg-muted uppercase">Tier</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-fg-muted uppercase">Network</th>
              </tr>
            </thead>
            <tbody>
              {iinRanges.map(r => (
                <tr key={r._id} className="border-b border-border-light last:border-0">
                  <td className="px-3 py-2 text-sm text-fg font-mono">{r.prefix}</td>
                  <td className="px-3 py-2 text-sm text-fg-soft">{r.bank_name}</td>
                  <td className="px-3 py-2 text-sm text-fg-soft capitalize">{r.card_type}</td>
                  <td className="px-3 py-2 text-sm text-fg-soft capitalize">{r.card_tier}</td>
                  <td className="px-3 py-2 text-sm text-fg-soft capitalize">{r.card_network}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Campaign Modal */}
      {showCampaignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCampaignModal(false)}>
          <div className="bg-surface border border-border rounded-2xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-fg mb-4">Create EMI Campaign</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Code (HDFC-JULY)" value={campaignForm.code} onChange={e => setCampaignForm({ ...campaignForm, code: e.target.value })} className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-fg" />
                <input placeholder="Title" value={campaignForm.title} onChange={e => setCampaignForm({ ...campaignForm, title: e.target.value })} className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-fg" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select value={campaignForm.scope} onChange={e => setCampaignForm({ ...campaignForm, scope: e.target.value })} className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-fg">
                  <option value="merchant">Merchant</option>
                  <option value="brand">Brand (cross-merchant)</option>
                </select>
                <input placeholder="Bank (HDFC)" value={campaignForm.bank} onChange={e => setCampaignForm({ ...campaignForm, bank: e.target.value })} className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-fg" />
              </div>
              <input placeholder="IIN prefixes (comma-separated, 6-digit)" value={campaignForm.iin_prefixes} onChange={e => setCampaignForm({ ...campaignForm, iin_prefixes: e.target.value })} className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-fg font-mono" />
              <input placeholder="Card tiers (platinum,signature,infinite)" value={campaignForm.card_tiers} onChange={e => setCampaignForm({ ...campaignForm, card_tiers: e.target.value })} className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-fg" />
              <div className="grid grid-cols-2 gap-3">
                <select value={campaignForm.emi_type} onChange={e => setCampaignForm({ ...campaignForm, emi_type: e.target.value })} className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-fg">
                  <option value="no_cost">No Cost EMI</option>
                  <option value="low_cost">Low Cost EMI</option>
                </select>
                <input placeholder="Products (optional, comma-separated SKU IDs)" value={campaignForm.products} onChange={e => setCampaignForm({ ...campaignForm, products: e.target.value })} className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-fg" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="number" placeholder="Max total (100)" value={campaignForm.max_total} onChange={e => setCampaignForm({ ...campaignForm, max_total: e.target.value })} className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-fg" />
                <input type="number" placeholder="Max per card (2)" value={campaignForm.max_per_card} onChange={e => setCampaignForm({ ...campaignForm, max_per_card: e.target.value })} className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-fg" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={campaignForm.requires_imei} onChange={e => setCampaignForm({ ...campaignForm, requires_imei: e.target.checked })} className="w-4 h-4 accent-accent" />
                <span className="text-sm text-fg-soft">Requires IMEI blocking (brand campaigns)</span>
              </label>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowCampaignModal(false)} className="flex-1 px-4 py-3 rounded-lg border border-border text-sm text-fg-soft hover:bg-surface-2">Cancel</button>
                <button onClick={handleCreateCampaign} disabled={actionLoading} className="flex-1 px-4 py-3 rounded-lg bg-accent text-bg font-semibold text-sm disabled:opacity-50">
                  {actionLoading ? 'Creating...' : 'Create Campaign'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* IIN Modal */}
      {showIinModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowIinModal(false)}>
          <div className="bg-surface border border-border rounded-2xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-fg mb-4">Add IIN Range</h3>
            <div className="space-y-3">
              <input placeholder="6-digit prefix (459130)" maxLength={6} value={iinForm.prefix} onChange={e => setIinForm({ ...iinForm, prefix: e.target.value.replace(/\D/g, '') })} className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-fg font-mono" />
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Bank code (HDFC)" value={iinForm.bank_code} onChange={e => setIinForm({ ...iinForm, bank_code: e.target.value })} className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-fg" />
                <input placeholder="Bank name" value={iinForm.bank_name} onChange={e => setIinForm({ ...iinForm, bank_name: e.target.value })} className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-fg" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <select value={iinForm.card_type} onChange={e => setIinForm({ ...iinForm, card_type: e.target.value })} className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-fg">
                  <option value="credit">Credit</option>
                  <option value="debit">Debit</option>
                </select>
                <select value={iinForm.card_tier} onChange={e => setIinForm({ ...iinForm, card_tier: e.target.value })} className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-fg">
                  <option value="standard">Standard</option>
                  <option value="gold">Gold</option>
                  <option value="platinum">Platinum</option>
                  <option value="signature">Signature</option>
                  <option value="infinite">Infinite</option>
                  <option value="coral">Coral</option>
                  <option value="sapphire">Sapphire</option>
                  <option value="elite">Elite</option>
                  <option value="magnus">Magnus</option>
                </select>
                <select value={iinForm.card_network} onChange={e => setIinForm({ ...iinForm, card_network: e.target.value })} className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-fg">
                  <option value="visa">Visa</option>
                  <option value="mastercard">Mastercard</option>
                  <option value="rupay">RuPay</option>
                  <option value="amex">Amex</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowIinModal(false)} className="flex-1 px-4 py-3 rounded-lg border border-border text-sm text-fg-soft hover:bg-surface-2">Cancel</button>
                <button onClick={handleCreateIIN} disabled={actionLoading || iinForm.prefix.length !== 6} className="flex-1 px-4 py-3 rounded-lg bg-accent text-bg font-semibold text-sm disabled:opacity-50">
                  {actionLoading ? 'Adding...' : 'Add IIN'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
