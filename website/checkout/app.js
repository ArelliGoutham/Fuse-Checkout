// OfferForge Hosted Checkout

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3010' : 'https://api.offerforge.io';

let sessionId = null;
let cart = null;
let merchantId = null;
let selectedMethod = null;
let selectedEMI = null;
let emiOptions = [];
let appliedDiscount = 0;

// === Init ===
async function init() {
  // Extract session_id from URL path
  const path = window.location.pathname;
  sessionId = path.split('/').filter(s => s.startsWith('sess_')).pop()
    || path.split('/').pop();

  if (!sessionId || sessionId === '' || sessionId === '/') {
    showError('No checkout session found', 'The checkout URL is missing a session ID.');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/checkout/${sessionId}/cart`);
    if (!res.ok) {
      if (res.status === 404) {
        showError('Session expired', 'This checkout session has expired. Please return to the store and try again.');
      } else {
        showError('Failed to load checkout', 'An error occurred while loading your checkout.');
      }
      return;
    }
    const data = await res.json();
    cart = data.cart;
    merchantId = data.merchant_id;
    appliedDiscount = data.applied_offers?.reduce((s, o) => s + o.discount_amount, 0) || 0;
    renderCart();
    showStep('cart');
  } catch (e) {
    showError('Connection failed', 'Could not connect to the checkout server. Please try again.');
  }
}

function formatINR(amount) { return '₹' + amount.toLocaleString('en-IN'); }

// === Step Management ===
function showStep(step) {
  document.querySelectorAll('.checkout-step').forEach(s => s.classList.remove('active'));
  document.getElementById(`step-${step}`).classList.add('active');
  // Update step indicators
  const steps = ['cart', 'details', 'payment'];
  const currentIdx = steps.indexOf(step);
  steps.forEach((s, i) => {
    const el = document.getElementById(`step-ind-${s}`);
    if (i < currentIdx) { el.className = 'step-indicator done'; el.textContent = '✓ ' + s; }
    else if (i === currentIdx) { el.className = 'step-indicator active'; el.textContent = s; }
    else { el.className = 'step-indicator pending'; el.textContent = s; }
  });
}

// === Render Cart ===
function renderCart() {
  if (!cart || cart.items.length === 0) {
    document.getElementById('cart-items').innerHTML = '<div class="empty-state">Your cart is empty</div>';
    return;
  }
  let html = cart.items.map(item => `
    <div class="cart-item">
      <div>
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-meta">Qty: ${item.qty} × ${formatINR(item.price)}</div>
      </div>
      <div class="cart-item-price">${formatINR(item.price * item.qty)}</div>
    </div>
  `).join('');
  html += `<div class="cart-total"><span>Subtotal</span><span>${formatINR(cart.amount)}</span></div>`;
  if (appliedDiscount > 0) {
    html += `<div class="cart-total cart-discount"><span>Discount</span><span>−${formatINR(appliedDiscount)}</span></div>`;
    html += `<div class="cart-total cart-final"><span>Total</span><span>${formatINR(cart.amount - appliedDiscount)}</span></div>`;
  }
  document.getElementById('cart-items').innerHTML = html;
}

// === Customer Details ===
async function submitCustomer() {
  const name = document.getElementById('cust-name').value;
  const email = document.getElementById('cust-email').value;
  const phone = document.getElementById('cust-phone').value;
  const line1 = document.getElementById('cust-line1').value;
  const city = document.getElementById('cust-city').value;
  const state = document.getElementById('cust-state').value;
  const pincode = document.getElementById('cust-pincode').value;

  if (!name || !email || !phone || !line1 || !city || !state || !pincode) {
    showToast('Please fill all fields', 'error');
    return;
  }

  const btn = document.getElementById('btn-continue-details');
  btn.innerHTML = '<span class="spinner"></span>';
  btn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/api/checkout/${sessionId}/customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone, address: { line1, city, state, pincode } }),
    });
    if (res.ok) {
      showStep('payment');
      loadPaymentMethods();
    } else {
      showToast('Failed to save details', 'error');
    }
  } catch (e) {
    showToast('Connection error', 'error');
  } finally {
    btn.innerHTML = 'Continue to Payment →';
    btn.disabled = false;
  }
}

// === Payment Methods ===
const METHODS = [
  { id: 'upi', label: 'UPI (PhonePe, GPay, Paytm)', icon: '📱' },
  { id: 'card', label: 'Credit / Debit Card', icon: '💳' },
  { id: 'netbanking', label: 'Net Banking', icon: '🏦' },
  { id: 'wallet', label: 'Wallet', icon: '👛' },
  { id: 'cod', label: 'Cash on Delivery', icon: '💵' },
];

function loadPaymentMethods() {
  const container = document.getElementById('payment-methods');
  container.innerHTML = METHODS.map(m => `
    <div class="payment-method" onclick="selectMethod('${m.id}')" id="method-${m.id}">
      <span class="payment-method-icon">${m.icon}</span>
      <span class="payment-method-label">${m.label}</span>
    </div>
  `).join('');
  document.getElementById('payment-total').textContent = formatINR(cart.amount - appliedDiscount);
}

async function selectMethod(methodId) {
  selectedMethod = methodId;
  selectedEMI = null;
  document.querySelectorAll('.payment-method').forEach(m => m.classList.remove('selected'));
  document.getElementById(`method-${methodId}`).classList.add('selected');

  // Show card input if card selected
  const cardInput = document.getElementById('card-input');
  const emiSection = document.getElementById('emi-section');
  cardInput.style.display = methodId === 'card' ? 'block' : 'none';
  emiSection.innerHTML = '';
  emiOptions = [];

  if (methodId === 'card') return; // Wait for card number input

  // For non-card methods, enable pay button
  if (methodId !== 'card') {
    const btn = document.getElementById('btn-pay');
    const btnText = document.getElementById('pay-btn-text');
    btn.disabled = false;
    btnText.textContent = `Pay ${formatINR(cart.amount - appliedDiscount)}`;
  } else {
    const btn = document.getElementById('btn-pay');
    btn.disabled = true;
    document.getElementById('pay-btn-text').textContent = 'Enter card number to continue';
  }
}

async function onCardInput(input) {
  const bin = input.value.replace(/\s/g, '');
  if (bin.length < 6) return;

  // Call select-payment with BIN to get EMI options
  try {
    const res = await fetch(`${API_BASE}/api/checkout/${sessionId}/select-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'card', bin }),
    });
    if (!res.ok) return;
    const data = await res.json();
    emiOptions = data.emi_options || [];

    if (emiOptions.length > 0) {
      renderEMIOptions(data.bank);
    }
  } catch (e) { /* ignore */ }
}

function renderEMIOptions(bank) {
  const container = document.getElementById('emi-section');
  let html = `<div class="emi-options"><h3 style="font-size:14px;font-weight:600;margin-bottom:12px;">${bank} EMI Options</h3><div class="emi-grid">`;
  for (const opt of emiOptions) {
    html += `
      <div class="emi-card" onclick="selectEMI(${opt.tenure_months}, '${opt.emi_type}')" id="emi-${opt.tenure_months}">
        <div class="emi-tenure">${opt.tenure_months} months</div>
        <div class="emi-amount">${formatINR(opt.customer_emi)}</div>
        <div class="emi-per-month">per month</div>
        <div class="emi-type-badge ${opt.emi_type === 'no_cost' ? 'no-cost' : 'standard'}">
          ${opt.emi_type === 'no_cost' ? 'No-Cost' : opt.emi_type === 'low_cost' ? 'Low-Cost' : 'Standard'}
        </div>
      </div>
    `;
  }
  html += '</div></div>';
  container.innerHTML = html;
}

function selectEMI(tenure, emiType) {
  selectedEMI = { tenure, emiType };
  document.querySelectorAll('.emi-card').forEach(c => c.classList.remove('selected'));
  document.getElementById(`emi-${tenure}`).classList.add('selected');
  // Enable pay button
  const btn = document.getElementById('btn-pay');
  const btnText = document.getElementById('pay-btn-text');
  btn.disabled = false;
  btnText.textContent = `Pay ${formatINR(cart.amount - appliedDiscount)}`;
}

// === Process Payment ===
async function processPayment() {
  const btn = document.getElementById('btn-pay');
  btn.innerHTML = '<span class="spinner"></span> Processing...';
  btn.disabled = true;

  try {
    const body = { method: selectedMethod };
    if (selectedEMI) { body.tenure = selectedEMI.tenure; body.emi_type = selectedEMI.emiType; }

    const res = await fetch(`${API_BASE}/api/checkout/${sessionId}/process-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (data.status === 'success') {
      // Redirect to merchant's success page
      window.location.href = data.redirect_url;
    } else {
      showToast(data.error?.message || 'Payment failed', 'error');
      btn.innerHTML = `Pay ${formatINR(cart.amount - appliedDiscount)}`;
      btn.disabled = false;
    }
  } catch (e) {
    showToast('Connection error', 'error');
    btn.innerHTML = `Pay ${formatINR(cart.amount - appliedDiscount)}`;
    btn.disabled = false;
  }
}

// === Helpers ===
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast ' + type + ' show';
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function showError(title, msg) {
  const container = document.querySelector('.checkout-container');
  container.innerHTML = `
    <div class="error-state">
      <h2>⚠ ${title}</h2>
      <p style="color:var(--text-muted);margin-bottom:20px;">${msg}</p>
    </div>
  `;
}

// Event listeners
document.getElementById('btn-continue-cart')?.addEventListener('click', () => showStep('details'));
document.getElementById('btn-continue-details')?.addEventListener('click', submitCustomer);
document.getElementById('btn-pay')?.addEventListener('click', processPayment);
document.getElementById('card-number')?.addEventListener('input', (e) => onCardInput(e.target));

// Start
init();
