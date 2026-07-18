const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3000';

export async function apiFetch(path: string, options: RequestInit = {}) {
  const apiKey = typeof window !== 'undefined' ? localStorage.getItem('offerforge_api_key') : null;
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 
      'Content-Type': 'application/json', 
      'x-api-key': apiKey || '', 
      ...options.headers 
    },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
