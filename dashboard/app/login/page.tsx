'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) return;

    setLoading(true);
    localStorage.setItem('offerforge_api_key', apiKey);
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 bg-accent rounded-lg flex items-center justify-center">
            <i className="fa-solid fa-bolt text-bg text-3xl"></i>
          </div>
        </div>

        {/* Card */}
        <div className="bg-surface rounded-2xl border border-border p-8">
          <h1 className="text-2xl font-bold text-fg text-center mb-2">OfferForge</h1>
          <p className="text-fg-muted text-center mb-8 text-sm">Enter your API key to access the merchant dashboard</p>

          <form onSubmit={handleConnect}>
            <div className="mb-6">
              <label htmlFor="apiKey" className="block text-sm font-medium text-fg mb-2">
                API Key
              </label>
              <input
                id="apiKey"
                type="password"
                placeholder="of_live_..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full bg-[#151821] border border-[#252836] rounded-[10px] px-3.5 py-2.5 text-fg text-sm placeholder-fg-muted focus:border-accent/50 outline-none transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !apiKey.trim()}
              className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-bg font-semibold py-2.5 rounded-[10px] transition"
            >
              {loading ? 'Connecting...' : 'Connect'}
            </button>
          </form>

          <p className="text-xs text-fg-muted text-center mt-6">
            Don't have an API key? Contact support.
          </p>
        </div>
      </div>
    </div>
  );
}
