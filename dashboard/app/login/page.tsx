'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { login } from '@/lib/api';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 bg-accent rounded-lg flex items-center justify-center">
            <i className="fa-solid fa-bolt text-bg text-3xl"></i>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-border p-8">
          <h1 className="text-2xl font-bold text-fg text-center mb-2">OfferForge</h1>
          <p className="text-fg-muted text-center mb-8 text-sm">Sign in to your merchant dashboard</p>

          {error && (
            <div className="bg-danger/10 border border-danger/20 rounded-lg p-3 text-danger text-sm mb-4">
              <i className="fa-solid fa-circle-exclamation mr-2"></i>{error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label htmlFor="email" className="block text-sm font-medium text-fg mb-2">Email</label>
              <input
                id="email" type="email" placeholder="owner@store.in"
                value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#151821] border border-[#252836] rounded-[10px] px-3.5 py-2.5 text-fg text-sm placeholder-fg-muted focus:border-accent/50 outline-none transition"
              />
            </div>
            <div className="mb-6">
              <label htmlFor="password" className="block text-sm font-medium text-fg mb-2">Password</label>
              <input
                id="password" type="password" placeholder="••••••••"
                value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#151821] border border-[#252836] rounded-[10px] px-3.5 py-2.5 text-fg text-sm placeholder-fg-muted focus:border-accent/50 outline-none transition"
              />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-bg font-semibold py-2.5 rounded-[10px] transition flex items-center justify-center gap-2">
              {loading ? <><i className="fa-solid fa-spinner fa-spin"></i> Signing in...</> : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-border space-y-3">
            <p className="text-xs text-fg-muted text-center">
              Don't have an account?{' '}
              <Link href="/signup" className="text-accent hover:text-accent-hover font-medium">Sign up</Link>
            </p>
            <p className="text-xs text-fg-muted text-center">
              Have an invite code?{' '}
              <Link href="/invite" className="text-accent hover:text-accent-hover font-medium">Enter code</Link>
            </p>
            <div className="pt-2">
              <details className="text-xs text-fg-muted">
                <summary className="cursor-pointer text-center">Use API key instead</summary>
                <div className="mt-3">
                  <input
                    type="password" placeholder="of_live_..."
                    onChange={(e) => {
                      if (e.target.value) {
                        localStorage.setItem('offerforge_api_key', e.target.value);
                        router.push('/');
                      }
                    }}
                    className="w-full bg-[#151821] border border-[#252836] rounded-[10px] px-3.5 py-2.5 text-fg text-sm placeholder-fg-muted focus:border-accent/50 outline-none transition"
                  />
                </div>
              </details>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
