'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

interface PGCredential {
  pg_name: string;
  status: string;
  test_mode: boolean;
  connected_at: string;
}

export default function SettingsPage() {
  const [credentials, setCredentials] = useState<PGCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    pg_name: 'razorpay',
    api_key: '',
    api_secret: '',
    webhook_secret: '',
    test_mode: true,
  });

  useEffect(() => {
    loadCredentials();
  }, []);

  const loadCredentials = () => {
    apiFetch('/api/admin/pg-credentials')
      .then(data => setCredentials(data.pg_credentials || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  const handleSave = async () => {
    if (!formData.api_key || !formData.api_secret) {
      setError('API Key and Secret are required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiFetch('/api/admin/pg-credentials', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      setSuccess(true);
      setShowForm(false);
      setFormData({ pg_name: 'razorpay', api_key: '', api_secret: '', webhook_secret: '', test_mode: true });
      loadCredentials();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save credentials');
    }
    setSaving(false);
  };

  const handleDeactivate = async (pgName: string) => {
    try {
      await apiFetch(`/api/admin/pg-credentials/${pgName}`, { method: 'DELETE' });
      loadCredentials();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deactivate');
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><i className="fa-solid fa-spinner fa-spin text-accent text-2xl"></i></div>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-fg">Payment Gateway</h2>
        <p className="text-fg-muted text-sm mt-1">
          Connect your payment gateway account. Keys are AES-256 encrypted before storage.
        </p>
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 text-danger text-sm flex items-center gap-2">
          <i className="fa-solid fa-circle-exclamation"></i>
          {error}
        </div>
      )}

      {success && (
        <div className="bg-success/10 border border-success/20 rounded-xl p-4 text-success text-sm flex items-center gap-2">
          <i className="fa-solid fa-check-circle"></i>
          Payment gateway connected successfully!
        </div>
      )}

      {/* Connected PGs */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-fg">Connected Gateways</h3>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-bg font-semibold px-4 py-2 rounded-lg transition text-sm"
          >
            <i className="fa-solid fa-plus text-xs"></i>
            Add Gateway
          </button>
        </div>

        {credentials.length === 0 && !showForm ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-surface-2 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fa-solid fa-plug text-fg-muted text-2xl"></i>
            </div>
            <p className="text-fg-muted text-sm">No payment gateway connected yet.</p>
            <p className="text-fg-muted text-xs mt-1">Connect Razorpay to start accepting real payments.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {credentials.map(cred => (
              <div key={cred.pg_name} className="flex items-center justify-between p-4 bg-surface-2 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
                    <i className="fa-solid fa-credit-card text-accent"></i>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-fg capitalize">{cred.pg_name}</div>
                    <div className="text-xs text-fg-muted flex items-center gap-2">
                      <span className={`inline-block w-2 h-2 rounded-full ${cred.status === 'active' ? 'bg-success' : 'bg-fg-muted'}`}></span>
                      {cred.status === 'active' ? 'Connected' : 'Inactive'}
                      {cred.test_mode && <span className="text-info">· Test mode</span>}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleDeactivate(cred.pg_name)}
                  className="text-danger text-sm font-medium hover:opacity-80"
                >
                  Deactivate
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Gateway Form */}
      {showForm && (
        <div className="bg-surface border border-border rounded-xl p-6">
          <h3 className="text-sm font-semibold text-fg mb-4">Connect Razorpay</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-fg-muted uppercase mb-2">Payment Gateway</label>
              <select
                value={formData.pg_name}
                onChange={e => setFormData({ ...formData, pg_name: e.target.value })}
                className="w-full bg-surface-2 border border-border rounded-lg px-4 py-3 text-sm text-fg"
              >
                <option value="razorpay">Razorpay</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-fg-muted uppercase mb-2">API Key</label>
              <input
                type="text"
                placeholder="rzp_live_xxx or rzp_test_xxx"
                value={formData.api_key}
                onChange={e => setFormData({ ...formData, api_key: e.target.value })}
                className="w-full bg-surface-2 border border-border rounded-lg px-4 py-3 text-sm text-fg font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-fg-muted uppercase mb-2">API Secret</label>
              <input
                type="password"
                placeholder="••••••••••••"
                value={formData.api_secret}
                onChange={e => setFormData({ ...formData, api_secret: e.target.value })}
                className="w-full bg-surface-2 border border-border rounded-lg px-4 py-3 text-sm text-fg font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-fg-muted uppercase mb-2">Webhook Secret</label>
              <input
                type="password"
                placeholder="whsec_xxx"
                value={formData.webhook_secret}
                onChange={e => setFormData({ ...formData, webhook_secret: e.target.value })}
                className="w-full bg-surface-2 border border-border rounded-lg px-4 py-3 text-sm text-fg font-mono"
              />
              <p className="text-xs text-fg-muted mt-1">
                Set webhook URL to: <code className="text-accent">https://api.fuse.io/api/webhooks/razorpay</code>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.test_mode}
                  onChange={e => setFormData({ ...formData, test_mode: e.target.checked })}
                  className="w-4 h-4 accent-accent"
                />
                <span className="text-sm text-fg-soft">Test mode (use test keys)</span>
              </label>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowForm(false)}
                className="px-5 py-3 rounded-lg border border-border text-sm font-semibold text-fg-soft hover:bg-surface-2"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-5 py-3 rounded-lg bg-accent hover:bg-accent-hover text-bg font-semibold text-sm disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save & Connect'}
              </button>
            </div>
          </div>

          <div className="mt-6 p-4 bg-surface-2 rounded-lg">
            <div className="flex items-start gap-3">
              <i className="fa-solid fa-circle-info text-info mt-1"></i>
              <div>
                <p className="text-sm text-fg-soft font-medium">Don't have a Razorpay account?</p>
                <p className="text-xs text-fg-muted mt-1">
                  Create one at <a href="https://razorpay.com" target="_blank" rel="noopener" className="text-accent underline">razorpay.com</a> — takes 5 minutes for KYC.
                  Money settles directly to your Razorpay bank account. Fuse never touches the money.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Multi-PG routing info */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-info/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <i className="fa-solid fa-route text-info"></i>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-fg">Smart Routing</h3>
            <p className="text-sm text-fg-muted mt-1">
              When multiple gateways are connected, Fuse automatically routes each payment to the gateway
              with the highest rolling 7-day success rate. If the primary gateway fails, Fuse falls back
              to the next best gateway automatically.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
