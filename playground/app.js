// OfferForge Playground — Sample checkout page

const API_BASE = 'http://localhost:3010';
let apiKey = 'demo-key-123';
let cart = [];
let availableOffers = [];
let appliedOffers = new Set();
let appliedCoupon = null;
let sessionId = 'playground_' + Date.now();
let lastValidation = null;

// Demo products
const DEMO_PRODUCTS = [
  { sku_id: 'SKU-IP15', name: 'iPhone 15 Pro', price: 129999, category: 'Electronics', brand: 'Apple', emoji: '📱' },
  { sku_id: 'SKU-S24', name: 'Galaxy S24 Ultra', price: 109999, category: 'Electronics', brand: 'Samsung', emoji: '📱' },
  { sku_id: 'SKU-TS001', name: 'Premium Cotton T-Shirt', price: 1299, category: 'Clothing', brand: null, emoji: '👕' },
  { sku_id: 'SKU-RS999', name: 'Running Shoes Pro', price: 3499, category: 'Footwear', brand: 'Nike', emoji: '👟' },
  { sku_id: 'SKU-BLT01', name: 'Leather Belt Classic', price: 799, category: 'Accessories', brand: null, emoji: '👜' },
  { sku_id: 'SKU-WATCH', name: 'Smart Watch', price: 24999, category: 'Electronics', brand: 'Apple', emoji: '⌚' },
];

const customer = { customer_id: 'playground_user', segments: ['new'], total_orders: 0, per_customer_used: 0 };

// === API ===
async function apiCall(method, path, body) {
  const start = Date.now();
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body: body ? JSON.stringify(body) : undefined,
  });
  const elapsed = Date.now() - start;
  const data = await res.json().catch(() => ({}));
  logApiCall(method, path, res.status, data, elapsed);
  return { status: res.status, data };
}

// === Cart ===
function addToCart(product) {
  const existing = cart.find(i => i.sku_id === product.sku_id);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({ ...product, qty: 1 });
  }
  renderCart();
  refreshOffers();
}

function removeFromCart(skuId) {
  cart = cart.filter(i => i.sku_id !== skuId);
  renderCart();
  refreshOffers();
}

function changeQty(skuId, delta) {
  const item = cart.find(i => i.sku_id === skuId);
  if (item) {
    item.qty = Math.max(0, item.qty + delta);
    if (item.qty === 0) removeFromCart(skuId);
    renderCart();
    refreshOffers();
  }
}

function getCartTotal() {
  return cart.reduce((sum, i) => sum + i.price * i.qty, 0);
}

function getCartPayload() {
  return {
    amount: getCartTotal(),
    items: cart.map(i => ({ sku_id: i.sku_id, category: i.category, brand: i.brand, price: i.price, qty: i.qty })),
  };
}

// === Offers ===
async function refreshOffers() {
  if (cart.length === 0) {
    availableOffers = [];
    appliedOffers.clear();
    appliedCoupon = null;
    renderOffers();
    renderSummary();
    return;
  }

  try {
    const { data } = await apiCall('POST', '/api/offers/available', {
      cart: getCartPayload(),
      customer,
    });
    // API returns offers directly with is_eligible as a property on each offer
    availableOffers = [...(data.coupons || []), ...(data.auto_offers || [])];
    renderOffers();
    renderSummary();
  } catch (e) {
    availableOffers = [];
    renderOffers();
    renderSummary();
  }
}

async function applyCoupon(code) {
  if (!code || cart.length === 0) return;
  
  const { status, data } = await apiCall('POST', '/api/offers/validate', {
    code: code.toUpperCase(),
    cart: getCartPayload(),
    customer,
  });

  if (status === 200 && data.valid) {
    appliedCoupon = { code: code.toUpperCase(), offer: data.offer, discount: data.discount_amount };
    lastValidation = data;
    showToast(`✓ ${code.toUpperCase()} applied — ₹${data.discount_amount} off`, 'success');
    renderOffers();
    renderSummary();
  } else {
    showToast(`✗ ${data.error?.message || data.reason || 'Invalid coupon'}`, 'error');
  }
}

function toggleOffer(offerId) {
  if (appliedOffers.has(offerId)) {
    appliedOffers.delete(offerId);
  } else {
    appliedOffers.add(offerId);
  }
  renderOffers();
  renderSummary();
}

// === Render ===
function formatINR(amount) {
  return '₹' + amount.toLocaleString('en-IN');
}

function renderProducts() {
  const grid = document.getElementById('productGrid');
  grid.innerHTML = DEMO_PRODUCTS.map(p => `
    <div class="product-card">
      <div class="product-emoji">${p.emoji}</div>
      <div class="product-name">${p.name}</div>
      <div class="product-meta">${p.category}${p.brand ? ' · ' + p.brand : ''}</div>
      <div class="product-price">${formatINR(p.price)}</div>
      <button class="product-add" onclick="addToCart(${JSON.stringify(p).replace(/"/g, '&quot;')})">
        <i class="fa-solid fa-plus"></i> Add to Cart
      </button>
    </div>
  `).join('');
}

function renderCart() {
  const cartEl = document.getElementById('cartItems');
  const subtotalEl = document.getElementById('cartSubtotal');
  
  if (cart.length === 0) {
    cartEl.innerHTML = '<div class="cart-empty">🛒 Your cart is empty<br>Add products to see offers</div>';
    subtotalEl.textContent = formatINR(0);
    return;
  }

  cartEl.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-info">
        <div class="cart-item-name">${item.emoji} ${item.name}</div>
        <div class="cart-item-meta">${item.category} · ${formatINR(item.price)} each</div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
          <button class="product-add" style="padding:2px 8px;width:auto;font-size:11px;" onclick="changeQty('${item.sku_id}',-1)">−</button>
          <span style="font-size:13px;font-weight:600;">${item.qty}</span>
          <button class="product-add" style="padding:2px 8px;width:auto;font-size:11px;" onclick="changeQty('${item.sku_id}',1)">+</button>
        </div>
      </div>
      <div class="cart-item-price">${formatINR(item.price * item.qty)}</div>
      <button class="cart-item-remove" onclick="removeFromCart('${item.sku_id}')">×</button>
    </div>
  `).join('');
  subtotalEl.textContent = formatINR(getCartTotal());
}

function renderOffers() {
  const offersEl = document.getElementById('offersSection');
  const couponEl = document.getElementById('couponBox');

  if (cart.length === 0) {
    offersEl.innerHTML = '';
    couponEl.style.display = 'none';
    return;
  }

  couponEl.style.display = 'block';

  // Show all offers (both eligible and ineligible with reason)
  if (availableOffers.length === 0) {
    offersEl.innerHTML = '<div style="font-size:13px;color:var(--text-muted);padding:12px 0;">No offers available for this cart</div>';
    return;
  }

  let html = '';
  for (const offer of availableOffers) {
    const offerId = offer._id;
    const isEligible = offer.is_eligible;
    const isApplied = appliedOffers.has(offerId) || (appliedCoupon && appliedCoupon.offer && appliedCoupon.offer._id === offerId);
    const isAuto = offer.type === 'auto_offer';
    const discount = computeDiscountDisplay(offer);
    const reason = offer.evaluation_result?.reason;
    
    html += `
      <div class="offer-card ${isApplied ? 'applied' : ''}" ${isEligible ? `onclick="toggleOffer('${offerId}')"` : 'style="opacity:0.5;cursor:default;"'}>
        <div class="offer-card-header">
          <div class="offer-card-title">
            <div class="offer-icon ${isAuto ? 'auto' : 'coupon'}">
              <i class="fa-solid ${isAuto ? 'fa-bolt' : 'fa-tag'}"></i>
            </div>
            <div>
              <div class="offer-name">${offer.title}${!isEligible ? ' <span style="font-size:11px;color:var(--danger);">(not eligible)</span>' : ''}</div>
              <div class="offer-desc">${offer.code || 'Auto-applied'} · ${discount}${reason ? ' · ' + reason : ''}</div>
            </div>
          </div>
          ${isEligible ? `<div class="offer-toggle ${isApplied ? 'active' : ''}"></div>` : ''}
        </div>
      </div>
    `;
  }
  offersEl.innerHTML = html;
}

function computeDiscountDisplay(offer) {
  if (offer.discount.type === 'flat') return `₹${offer.discount.value} off`;
  return `${offer.discount.value}% off${offer.discount.max_discount ? ` (max ₹${offer.discount.max_discount})` : ''}`;
}

function renderSummary() {
  const subtotal = getCartTotal();
  let totalDiscount = 0;

  // Calculate discount from applied auto-offers
  for (const offer of availableOffers) {
    if (appliedOffers.has(offer._id) && offer.is_eligible) {
      totalDiscount += computeDiscount(offer, subtotal);
    }
  }

  // Add coupon discount
  if (appliedCoupon) {
    totalDiscount += appliedCoupon.discount;
  }

  const finalAmount = Math.max(0, subtotal - totalDiscount);
  const summaryEl = document.getElementById('cartSummary');
  
  let html = `<div class="summary-row"><span>Subtotal</span><span>${formatINR(subtotal)}</span></div>`;
  
  if (appliedCoupon) {
    html += `<div class="summary-row discount"><span>${appliedCoupon.code}</span><span>−${formatINR(appliedCoupon.discount)}</span></div>`;
  }
  
  for (const offer of availableOffers) {
    if (appliedOffers.has(offer._id) && offer.is_eligible && offer.type === 'auto_offer') {
      const disc = computeDiscount(offer, subtotal);
      if (disc > 0) {
        html += `<div class="summary-row discount"><span>${offer.title}</span><span>−${formatINR(disc)}</span></div>`;
      }
    }
  }

  html += `<div class="summary-total"><span>Total</span><span>${formatINR(finalAmount)}</span></div>`;
  
  if (totalDiscount > 0) {
    html += `<div class="summary-savings"><i class="fa-solid fa-arrow-trend-down"></i> You save ${formatINR(totalDiscount)} on this order!</div>`;
  }

  html += `<button class="checkout-btn" ${cart.length === 0 ? 'disabled' : ''} onclick="checkout()">Proceed to Pay ${formatINR(finalAmount)}</button>`;

  summaryEl.innerHTML = html;
}

function computeDiscount(offer, cartAmount) {
  if (offer.discount.type === 'flat') return Math.min(offer.discount.value, cartAmount);
  const pct = Math.round((cartAmount * offer.discount.value) / 100);
  return offer.discount.max_discount ? Math.min(pct, offer.discount.max_discount) : pct;
}

// === Checkout ===
async function checkout() {
  if (cart.length === 0) return;
  
  const btn = document.querySelector('.checkout-btn');
  if (btn) { btn.innerHTML = '<span class="spinner"></span> Creating checkout…'; btn.disabled = true; }

  try {
    // Create a checkout session via the OfferForge checkout API
    const cartPayload = {
      amount: getCartTotal(),
      items: cart.map(i => ({
        sku_id: i.sku_id, name: i.name, price: i.price, qty: i.qty,
        category: i.category, brand: i.brand,
      })),
    };

    const { data } = await apiCall('POST', '/api/checkout/sessions', {
      cart: cartPayload,
      redirect_urls: {
        success: window.location.origin + '?status=success',
        cancel: window.location.origin + '?status=cancel',
      },
      customer: { email: 'demo@playground.in' },
    });

    // Log to merchant panel
    logApiCall('POST', '/api/checkout/sessions', 201, data, 0);

    // Redirect to hosted checkout page
    // In local dev, point to localhost:8082; in production, use the checkout_url from API
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const checkoutUrl = isLocal
      ? `http://localhost:8082/${data.session_id}`
      : data.checkout_url;

    showToast('Redirecting to checkout…', 'success');
    setTimeout(() => { window.location.href = checkoutUrl; }, 800);
  } catch (e) {
    showToast('Checkout failed: ' + e.message, 'error');
    if (btn) { btn.innerHTML = 'Proceed to Pay'; btn.disabled = false; }
  }
}

// === Merchant Panel ===
function logApiCall(method, path, status, data, elapsed) {
  const logEl = document.getElementById('apiLog');
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = `
    <span class="log-method ${method}">${method}</span> ${path} 
    <span class="log-status ${status < 400 ? 'ok' : 'err'}">${status}</span> 
    <span style="color:var(--text-muted)">${elapsed}ms</span>
    ${data && Object.keys(data).length > 0 ? `<div class="log-body">${JSON.stringify(data).substring(0, 200)}</div>` : ''}
  `;
  logEl.prepend(entry);
  
  // Keep last 20 entries
  while (logEl.children.length > 20) {
    logEl.removeChild(logEl.lastChild);
  }

  // Show rule trace for validation responses
  if (path === '/api/offers/validate' && data && data.offer) {
    renderRuleTrace(data);
  }
}

function renderRuleTrace(validationData) {
  const traceEl = document.getElementById('ruleTrace');
  const offer = validationData.offer;
  
  let html = '<div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;">Rule evaluation for ' + (offer.code || offer.title) + ':</div>';
  
  // Status check
  html += `<div class="rule-item"><span class="${offer.status === 'active' ? 'rule-pass' : 'rule-fail'}">${offer.status === 'active' ? '✓' : '✗'}</span><span class="rule-name">status === 'active'</span></div>`;
  
  // Rules
  if (offer.rules && offer.rules.length > 0) {
    for (const rule of offer.rules) {
      html += `<div class="rule-item"><span class="rule-pass">✓</span><span class="rule-name">${rule.rule_type}</span></div>`;
    }
  } else {
    html += `<div class="rule-item"><span class="rule-pass">✓</span><span class="rule-name">no rules — always passes</span></div>`;
  }
  
  // Result
  html += `<div class="rule-item" style="margin-top:6px;border-top:1px solid var(--border);padding-top:8px;"><span class="${validationData.valid ? 'rule-pass' : 'rule-fail'}">${validationData.valid ? '✓ ELIGIBLE' : '✗ NOT ELIGIBLE'}</span><span class="rule-name">discount: ₹${validationData.discount_amount || 0}</span></div>`;
  
  traceEl.innerHTML = html;
}

// === Toast ===
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast ' + type + ' show';
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// === Mode toggle ===
function setMode(mode) {
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  document.getElementById('merchantPanel').style.display = mode === 'merchant' ? 'block' : 'none';
  document.getElementById('customerView').style.display = mode === 'customer' ? 'block' : 'none';
  
  const layout = document.querySelector('.playground');
  if (mode === 'merchant') {
    layout.style.gridTemplateColumns = '1fr 400px';
  } else {
    layout.style.gridTemplateColumns = '1fr 400px';
  }
}

// === Init ===
document.getElementById('apiKeyInput').value = apiKey;
document.getElementById('apiKeyInput').addEventListener('input', (e) => {
  apiKey = e.target.value.trim();
});

document.getElementById('couponInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    applyCoupon(e.target.value);
    e.target.value = '';
  }
});

document.getElementById('couponApplyBtn').addEventListener('click', () => {
  const input = document.getElementById('couponInput');
  applyCoupon(input.value);
  input.value = '';
});

renderProducts();
renderCart();
