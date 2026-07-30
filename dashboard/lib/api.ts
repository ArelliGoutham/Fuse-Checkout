const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3010';

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('fuse_token') : null;
  const apiKey = typeof window !== 'undefined' ? localStorage.getItem('fuse_api_key') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else if (apiKey) {
    headers['x-api-key'] = apiKey;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function login(email: string, password: string): Promise<{ token: string }> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error('Invalid email or password');
  const data = await res.json();
  if (typeof window !== 'undefined') localStorage.setItem('fuse_token', data.token);
  return data;
}

export async function signup(email: string, password: string, name: string, storeName: string): Promise<{ token: string }> {
  const res = await fetch(`${API_BASE}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name, store_name: storeName }),
  });
  if (!res.ok) throw new Error('Signup failed');
  const data = await res.json();
  if (typeof window !== 'undefined') localStorage.setItem('fuse_token', data.token);
  return data;
}

export async function acceptInvite(inviteCode: string, email: string, password: string, name: string): Promise<{ token: string }> {
  const res = await fetch(`${API_BASE}/api/auth/accept-invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ invite_code: inviteCode, email, password, name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: 'Failed to accept invite' } }));
    throw new Error(err.error?.message || 'Failed to accept invite');
  }
  const data = await res.json();
  if (typeof window !== 'undefined') localStorage.setItem('fuse_token', data.token);
  return data;
}

export function logout() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('fuse_token');
    localStorage.removeItem('fuse_api_key');
  }
}

export function getAuthState(): { token: string | null; apiKey: string | null } {
  if (typeof window === 'undefined') return { token: null, apiKey: null };
  return {
    token: localStorage.getItem('fuse_token'),
    apiKey: localStorage.getItem('fuse_api_key'),
  };
}
