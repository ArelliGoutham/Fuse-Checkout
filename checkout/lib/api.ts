const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3010';

export interface CartItem {
  sku_id: string;
  name: string;
  price: number;
  qty: number;
  category?: string;
  brand?: string;
}

export interface Cart {
  amount: number;
  items: CartItem[];
}

export interface Offer {
  _id: string;
  code: string | null;
  type: 'coupon' | 'auto_offer';
  title: string;
  discount: { type: 'flat' | 'percentage'; value: number; max_discount: number | null };
  is_eligible: boolean;
  evaluation_result?: { reason?: string };
}

export interface EMIOption {
  tenure_months: number;
  customer_emi: number;
  emi_type: 'standard' | 'no_cost' | 'low_cost';
  bank: string;
}

export async function fetchCart(sessionId: string) {
  const res = await fetch(`${API_BASE}/api/checkout/${sessionId}/cart`);
  if (!res.ok) throw new Error('Failed to load cart');
  return res.json();
}

export async function saveCustomer(sessionId: string, data: {
  name: string; email: string; phone: string;
  address: { line1: string; city: string; state: string; pincode: string };
}) {
  const res = await fetch(`${API_BASE}/api/checkout/${sessionId}/customer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.ok;
}

export async function fetchOffers(sessionId: string, cart: Cart, apiKey: string) {
  const res = await fetch(`${API_BASE}/api/offers/available`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify({
      cart,
      customer: { customer_id: `checkout_${sessionId}`, segments: ['new'], total_orders: 0, per_customer_used: 0 },
    }),
  });
  if (!res.ok) return { coupons: [], auto_offers: [] };
  return res.json();
}

export async function validateCoupon(code: string, cart: Cart, apiKey: string) {
  const res = await fetch(`${API_BASE}/api/offers/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify({
      code: code.toUpperCase(), cart,
      customer: { customer_id: 'checkout', segments: ['new'], total_orders: 0, per_customer_used: 0 },
    }),
  });
  return { status: res.status, data: await res.json() };
}

export async function selectPayment(sessionId: string, method: string, bin?: string) {
  const res = await fetch(`${API_BASE}/api/checkout/${sessionId}/select-payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, bin }),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function processPayment(sessionId: string, method: string, tenure?: number) {
  const res = await fetch(`${API_BASE}/api/checkout/${sessionId}/process-payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, ...(tenure ? { tenure } : {}) }),
  });
  return { status: res.status, data: await res.json() };
}

export function formatINR(n: number) {
  if (n == null || isNaN(n)) return '₹0';
  return '₹' + n.toLocaleString('en-IN');
}

export function computeDiscount(o: Offer, amount: number): number {
  if (o.discount.type === 'flat') return Math.min(o.discount.value, amount);
  const pct = Math.round((amount * o.discount.value) / 100);
  return o.discount.max_discount ? Math.min(pct, o.discount.max_discount) : pct;
}
