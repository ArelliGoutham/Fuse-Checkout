'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signup } from '@/lib/api';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [storeName, setStoreName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !name || !storeName) return;
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setError(null);
    setLoading(true);
    try {
      await signup(email, password, name, storeName);
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
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
          <h1 className="text-2xl font-bold text-fg text-center mb-2">Create Account</h1>
          <p className="text-fg-muted text-center mb-8 text-sm">Start managing your offers today</p>

          {error && (
            <div className="bg-danger/10 border border-danger/20 rounded-lg p-3 text-danger text-sm mb-4">
              <i className="fa-solid fa-circle-exclamation mr-2"></i>{error}
            </div>
          )}

          <form onSubmit={handleSignup}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-fg mb-2">Your Name</label>
              <input type="text" placeholder="John Doe" value={name} onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#151821] border border-[#252836] rounded-[10px] px-3.5 py-2.5 text-fg text-sm placeholder-fg-muted focus:border-accent/50 outline-none transition" />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-fg mb-2">Store Name</label>
              <input type="text" placeholder="TechStore.in" value={storeName} onChange={(e) => setStoreName(e.target.value)}
                className="w-full bg-[#151821] border border-[#252836] rounded-[10px] px-3.5 py-2.5 text-fg text-sm placeholder-fg-muted focus:border-accent/50 outline-none transition" />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-fg mb-2">Email</label>
              <input type="email" placeholder="owner@store.in" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#151821] border border-[#252836] rounded-[10px] px-3.5 py-2.5 text-fg text-sm placeholder-fg-muted focus:border-accent/50 outline-none transition" />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-fg mb-2">Password (min 8 chars)</label>
              <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#151821] border border-[#252836] rounded-[10px] px-3.5 py-2.5 text-fg text-sm placeholder-fg-muted focus:border-accent/50 outline-none transition" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-bg font-semibold py-2.5 rounded-[10px] transition flex items-center justify-center gap-2">
              {loading ? <><i className="fa-solid fa-spinner fa-spin"></i> Creating account...</> : 'Create Account'}
            </button>
          </form>

          <p className="text-xs text-fg-muted text-center mt-6">
            Already have an account?{' '}
            <Link href="/login" className="text-accent hover:text-accent-hover font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
