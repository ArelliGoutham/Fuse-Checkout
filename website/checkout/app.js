// OfferForge Hosted Checkout — Light + Dark theme, mobile-first

const API_BASE = location.hostname === 'localhost' || location.hostname === '127.0.0.1' ? 'http://localhost:3010' : 'https://api.offerforge.io';

let sessionId = null, cart = null, merchantId = null;
let selectedMethod = null, selectedEMI = null, emiOptions = [];
let appliedCoupon = null, appliedDiscount = 0, autoOffers = [];
let customerSaved = false;
let currentTheme = 'dark';

function formatINR(n) { return '₹' + n.toLocaleString('en-IN'); }
function getFinalAmount() { return Math.max(0, (cart?.amount || 0) - appliedDiscount - getAutoDiscount()); }
function getAutoDiscount() {
  let d = 0;
  for (const o of autoOffers) { if (o._applied && o.is_eligible) d += computeDisc(o); }
  return d;
}
function computeDisc(o) {
  const amt = cart?.amount || 0;
  if (o.discount.type === 'flat') return Math.min(o.discount.value, amt);
  const pct = Math.round((amt * o.discount.value) / 100);
  return o.discount.max_discount ? Math.min(pct, o.discount.max_discount) : pct;
}

// === Init ===
async function init() {
  // Theme
  const savedTheme = sessionStorage.getItem('of_theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  setTheme(savedTheme);

  // Session ID from URL
  const path = location.pathname;
  sessionId = path.split('/').filter(s => s.startsWith('sess_')).pop() || path.split('/').pop();
  if (!sessionId || sessionId === '/' || sessionId === '') { showError('No checkout session', 'The URL is missing a session ID.'); return; }

  try {
    const res = await fetch(`${API_BASE}/api/checkout/${sessionId}/cart`);
    if (!res.ok) { showError(res.status === 404 ? 'Session expired' : 'Checkout error', res.status === 404 ? 'This session has expired. Please return to the store.' : 'Could not load checkout.'); return; }
    const data = await res.json();
    cart = data.cart; merchantId = data.merchant_id;
    appliedDiscount = data.applied_offers?.reduce((s, o) => s + o.discount_amount, 0) || 0;
    renderCart();
    // Fetch available offers
    await fetchOffers();
    showStep('review');
    updatePayBar();
  } catch (e) { showError('Connection failed', 'Could not connect to checkout server.'); }
}

function setTheme(t) {
  currentTheme = t;
  document.documentElement.setAttribute('data-theme', t);
  sessionStorage.setItem('of_theme', t);
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = t === 'dark' ? '☀' : '🌙';
}

// === Steps ===
function showStep(step) {
  document.querySelectorAll('.checkout-step').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(`step-${step}`); if (el) el.classList.add('active');
  const steps = ['review', 'details', 'payment'];
  const idx = steps.indexOf(step);
  steps.forEach((s, i) => {
    const pill = document.getElementById(`pill-${s}`); if (!pill) return;
    pill.className = 'step-pill ' + (i < idx ? 'done' : i === idx ? 'active' : '');
    pill.textContent = (i < idx ? '✓ ' : '') + s.charAt(0).toUpperCase() + s.slice(1);
  });
  window.scrollTo(0, 0);
  updatePayBar();
}

// === Render Cart ===
function renderCart() {
  if (!cart || !cart.items?.length) { document.getElementById('cartItems').innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px;">Cart is empty</p>'; return; }
  document.getElementById('cartItems').innerHTML = cart.items.map(i => `
    <div class="cart-item">
      <div class="cart-item-emoji">${i.category === 'Electronics' ? '📱' : i.category === 'Clothing' ? '👕' : i.category === 'Footwear' ? '👟' : i.category === 'Accessories' ? '👜' : '📦'}</div>
      <div class="cart-item-info"><div class="cart-item-name">${i.name}</div><div class="cart-item-meta">Qty: ${i.qty} × ${formatINR(i.price)}</div></div>
      <div class="cart-item-price">${formatINR(i.price * i.qty)}</div>
    </div>`).join('');
}

// === Offers ===
async function fetchOffers() {
  if (!cart?.items?.length) return;
  autoOffers = [];
  try {
    const res = await fetch(`${API_BASE}/api/offers/available`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': 'demo-key-123' },
      body: JSON.stringify({ cart: { amount: cart.amount, items: cart.items }, customer: { customer_id: 'checkout_' + sessionId, segments: ['new'], total_orders: 0, per_customer_used: 0 } }),
    });
    if (!res.ok) return;
    const data = await res.json();
    autoOffers = [...(data.auto_offers || [])].filter(o => o.is_eligible);
    // Auto-apply all eligible auto-offers
    autoOffers.forEach(o => o._applied = true);
    renderBestOffer();
    updatePayBar();
  } catch (e) { /* ignore */ }
}

function renderBestOffer() {
  const el = document.getElementById('bestOfferSection');
  if (autoOffers.length === 0 && !appliedCoupon) { el.innerHTML = ''; return; }
  let html = '';
  if (autoOffers.length > 0) {
    html += `<div class="best-offer"><div class="best-offer-title"><i class="fa-solid fa-bolt"></i> Best Offers For You</div>`;
    for (const o of autoOffers) {
      const disc = computeDisc(o);
      html += `<div class="best-offer-row">
        <div class="best-offer-icon auto"><i class="fa-solid fa-bolt"></i></div>
        <div class="best-offer-name">${o.title}</div>
        <div class="best-offer-saving">−${formatINR(disc)}</div>
        <div class="offer-toggle ${o._applied ? 'active' : ''}" onclick="toggleAutoOffer('${o._id}')"></div>
      </div>`;
    }
    html += `</div>`;
  }
  el.innerHTML = html;
}

function toggleAutoOffer(id) {
  const o = autoOffers.find(x => x._id === id); if (!o) return;
  o._applied = !o._applied;
  renderBestOffer();
  updatePayBar();
}

// === Coupon ===
async function applyCouponCk() {
  const input = document.getElementById('couponInput');
  const code = input.value.trim().toUpperCase();
  if (!code || !cart?.items?.length) return;
  try {
    const res = await fetch(`${API_BASE}/api/offers/validate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': 'demo-key-123' },
      body: JSON.stringify({ code, cart: { amount: cart.amount, items: cart.items }, customer: { customer_id: 'checkout_' + sessionId, segments: ['new'], total_orders: 0, per_customer_used: 0 } }),
    });
    const data = await res.json();
    if (res.ok && data.valid) {
      appliedCoupon = { code, discount: data.discount_amount };
      appliedDiscount = data.discount_amount;
      input.value = '';
      renderCouponApplied();
      renderBestOffer();
      updatePayBar();
    } else {
      showToast(data.error?.message || data.reason || 'Invalid coupon', 'error');
    }
  } catch (e) { showToast('Failed to validate coupon', 'error'); }
}

function renderCouponApplied() {
  const el = document.getElementById('couponAppliedTag');
  if (appliedCoupon) {
    el.innerHTML = `<div class="coupon-applied-tag"><i class="fa-solid fa-check-circle"></i> ${appliedCoupon.code} applied (−${formatINR(appliedCoupon.discount)}) <button onclick="removeCoupon()">×</button></div>`;
    document.getElementById('couponInputRow').style.display = 'none';
  } else {
    el.innerHTML = '';
    document.getElementById('couponInputRow').style.display = 'flex';
  }
}

function removeCoupon() { appliedCoupon = null; appliedDiscount = 0; renderCouponApplied(); renderBestOffer(); updatePayBar(); }

// === Payment ===
const METHODS = [
  { id: 'upi', label: 'UPI', sub: 'PhonePe, GPay, Paytm', icon: '📱' },
  { id: 'card', label: 'Credit / Debit Card', sub: 'Visa, Mastercard, RuPay', icon: '💳' },
  { id: 'netbanking', label: 'Net Banking', sub: 'All major banks', icon: '🏦' },
  { id: 'wallet', label: 'Wallet', sub: 'Paytm, Amazon Pay', icon: '👛' },
  { id: 'cod', label: 'Cash on Delivery', sub: 'Pay when you receive', icon: '💵' },
];

function renderPaymentMethods() {
  document.getElementById('paymentMethods').innerHTML = METHODS.map(m => `
    <div class="payment-method" id="pm-${m.id}" onclick="selectMethod('${m.id}')">
      <span class="pm-icon">${m.icon}</span>
      <div style="flex:1;"><div class="pm-label">${m.label}</div><div class="pm-sublabel">${m.sub}</div></div>
      <div class="pm-radio"></div>
    </div>`).join('');
}

function selectMethod(id) {
  selectedMethod = id; selectedEMI = null;
  document.querySelectorAll('.payment-method').forEach(m => m.classList.remove('selected'));
  document.getElementById(`pm-${id}`).classList.add('selected');
  document.getElementById('cardArea').classList.toggle('show', id === 'card');
  document.getElementById('emiSection').innerHTML = '';
  emiOptions = [];
  updatePayBar();
}

async function onCardInput(input) {
  const bin = input.value.replace(/\s/g, '');
  if (bin.length < 6) return;
  if (!cart?.items?.length) return;
  try {
    const res = await fetch(`${API_BASE}/api/checkout/${sessionId}/select-payment`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'card', bin }),
    });
    if (!res.ok) return;
    const data = await res.json();
    emiOptions = data.emi_options || [];
    if (emiOptions.length > 0) renderEMI(data.bank);
  } catch (e) {}
}

function renderEMI(bank) {
  let html = `<div class="emi-section"><div style="font-size:13px;font-weight:600;margin-bottom:10px;">${bank} EMI Options</div><div class="emi-grid">`;
  for (const o of emiOptions) {
    html += `<div class="emi-card" id="emi-${o.tenure_months}" onclick="selectEMI(${o.tenure_months})">
      <div class="emi-tenure">${o.tenure_months} months</div>
      <div class="emi-amount">${formatINR(o.customer_emi)}</div>
      <div class="emi-unit">per month</div>
      <div class="emi-tag ${o.emi_type === 'no_cost' ? 'no-cost' : 'standard'}">${o.emi_type === 'no_cost' ? 'No-Cost' : o.emi_type === 'low_cost' ? 'Low-Cost' : 'Standard'}</div>
    </div>`;
  }
  html += `</div></div>`;
  document.getElementById('emiSection').innerHTML = html;
}

function selectEMI(tenure) {
  selectedEMI = { tenure };
  document.querySelectorAll('.emi-card').forEach(c => c.classList.remove('selected'));
  document.getElementById(`emi-${tenure}`).classList.add('selected');
  updatePayBar();
}

// === Pay bar (sticky bottom) ===
function updatePayBar() {
  const bar = document.getElementById('payBar');
  const activeStep = document.querySelector('.checkout-step.active')?.id;
  if (activeStep === 'step-payment' && selectedMethod && (selectedMethod !== 'card' || selectedEMI)) {
    bar.style.display = 'flex';
    document.getElementById('payAmount').textContent = formatINR(getFinalAmount());
  } else if (activeStep === 'step-review') {
    bar.style.display = 'flex';
    document.getElementById('payAmount').textContent = formatINR(getFinalAmount());
  } else {
    bar.style.display = 'none';
  }
}

// === Customer details ===
async function submitDetails() {
  const name = val('custName'), email = val('custEmail'), phone = val('custPhone');
  const line1 = val('custLine1'), city = val('custCity'), state = val('custState'), pincode = val('custPincode');
  if (!name || !email || !phone || !line1 || !city || !state || !pincode) { showToast('Please fill all fields', 'error'); return; }
  const btn = document.getElementById('btnContinueDetails'); btn.innerHTML = '<span class="spinner"></span>'; btn.disabled = true;
  try {
    const res = await fetch(`${API_BASE}/api/checkout/${sessionId}/customer`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone, address: { line1, city, state, pincode } }),
    });
    if (res.ok) { customerSaved = true; renderPaymentMethods(); showStep('payment'); }
    else showToast('Failed to save details', 'error');
  } catch (e) { showToast('Connection error', 'error'); }
  btn.innerHTML = 'Continue to Payment →'; btn.disabled = false;
}

function val(id) { return document.getElementById(id)?.value.trim() || ''; }

// === Process Payment ===
async function processPayment() {
  const activeStep = document.querySelector('.checkout-step.active')?.id;
  if (activeStep === 'step-review') { showStep('details'); return; }
  if (activeStep === 'step-details') { await submitDetails(); return; }
  // Payment step
  if (!selectedMethod) { showToast('Select a payment method', 'error'); return; }
  if (selectedMethod === 'card' && !selectedEMI && emiOptions.length > 0) { showToast('Select an EMI plan', 'error'); return; }
  if (selectedMethod === 'card' && !selectedEMI && emiOptions.length === 0) { /* No EMI available, proceed as normal card payment */ }

  const btn = document.getElementById('payBtn'); btn.innerHTML = '<span class="spinner"></span> Processing...'; btn.disabled = true;
  try {
    const body = { method: selectedMethod };
    if (selectedEMI) body.tenure = selectedEMI.tenure;
    const res = await fetch(`${API_BASE}/api/checkout/${sessionId}/process-payment`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (data.status === 'success') { window.location.href = data.redirect_url; }
    else { showToast(data.error?.message || 'Payment failed', 'error'); btn.innerHTML = `Pay ${formatINR(getFinalAmount())}`; btn.disabled = false; }
  } catch (e) { showToast('Payment failed', 'error'); btn.innerHTML = `Pay ${formatINR(getFinalAmount())}`; btn.disabled = false; }
}

// === Helpers ===
function showToast(msg, type = 'success') { const t = document.getElementById('toast'); t.textContent = msg; t.className = 'toast ' + type + ' show'; setTimeout(() => t.classList.remove('show'), 3000); }
function showError(title, msg) { document.querySelector('.checkout-wrap').innerHTML = `<div class="error-state"><h2>⚠ ${title}</h2><p>${msg}</p></div>`; document.getElementById('payBar').style.display = 'none'; }

// === Event wiring ===
document.getElementById('themeToggle')?.addEventListener('click', () => setTheme(currentTheme === 'dark' ? 'light' : 'dark'));
document.getElementById('couponBtn')?.addEventListener('click', applyCouponCk);
document.getElementById('couponInput')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); applyCouponCk(); } });
document.getElementById('btnContinueDetails')?.addEventListener('click', submitDetails);
document.getElementById('cardNumber')?.addEventListener('input', (e) => onCardInput(e.target));
document.getElementById('payBtn')?.addEventListener('click', processPayment);

init();
