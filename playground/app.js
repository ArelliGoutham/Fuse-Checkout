// OfferForge Playground — Real Store Experience
// Like Flipkart: offers on product cards, PDP with offer details, then hosted checkout

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3010' : 'https://api.offerforge.io';
const CHECKOUT_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:8082' : 'https://checkout.offerforge.io';

let apiKey = 'demo-key-123';
let cart = [];
let availableOffers = [];
let appliedOffers = new Set();
let appliedCoupon = null;
let pdpProduct = null;
let pdpOffers = [];

// Demo products — a real store catalog
const DEMO_PRODUCTS = [
  { sku_id: 'SKU-IP15', name: 'iPhone 15 Pro 256GB', price: 129999, category: 'Electronics', subcategory: 'Smartphones', brand: 'Apple', emoji: '📱', rating: 4.8 },
  { sku_id: 'SKU-S24', name: 'Galaxy S24 Ultra 512GB', price: 109999, category: 'Electronics', subcategory: 'Smartphones', brand: 'Samsung', emoji: '📱', rating: 4.6 },
  { sku_id: 'SKU-WATCH', name: 'Apple Watch Series 9', price: 41900, category: 'Electronics', subcategory: 'Wearables', brand: 'Apple', emoji: '⌚', rating: 4.7 },
  { sku_id: 'SKU-TS001', name: 'Premium Cotton T-Shirt', price: 1299, category: 'Clothing', subcategory: 'Tops', brand: 'Levi\'s', emoji: '👕', rating: 4.3 },
  { sku_id: 'SKU-RS999', name: 'Nike Running Shoes Pro', price: 8999, category: 'Footwear', subcategory: 'Sports', brand: 'Nike', emoji: '👟', rating: 4.5 },
  { sku_id: 'SKU-BLT01', name: 'Leather Belt Classique', price: 1599, category: 'Accessories', subcategory: 'Belts', brand: 'Tommy', emoji: '👜', rating: 4.2 },
];

// === API ===
async function apiCall(method, path, body) {
  const start = Date.now();
  const res = await fetch(`${API_BASE}${path}`, {
    method, headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body: body ? JSON.stringify(body) : undefined,
  });
  const elapsed = Date.now() - start;
  const data = await res.json().catch(() => ({}));
  logApiCall(method, path, res.status, elapsed);
  return { status: res.status, data };
}

function formatINR(n) { return '₹' + n.toLocaleString('en-IN'); }
function getCartTotal() { return cart.reduce((s, i) => s + i.price * i.qty, 0); }
function getCartPayload() {
  return {
    amount: getCartTotal(),
    items: cart.map(i => ({ sku_id: i.sku_id, name: i.name, price: i.price, qty: i.qty, category: i.category, brand: i.brand })),
  };
}

// === Render Product Grid ===
function renderProducts() {
  const grid = document.getElementById('productGrid');
  grid.innerHTML = DEMO_PRODUCTS.map(p => {
    // Quick check: high-value electronics get EMI badge
    const hasEMI = p.category === 'Electronics' && p.price > 10000;
    const hasOffer = p.price > 500; // Simplified for demo
    
    return `
      <div class="product-card" onclick="openPDP(${JSON.stringify(p).replace(/"/g, '&quot;')})">
        ${hasEMI ? '<div class="offer-badge emi">EMI from ' + formatINR(Math.round(p.price / 12)) + '/mo</div>' : ''}
        ${!hasEMI && hasOffer ? '<div class="offer-badge">Offers available</div>' : ''}
        <div class="product-emoji">${p.emoji}</div>
        <div class="product-name">${p.name}</div>
        <div class="product-meta">${p.brand} · ${p.subcategory} · ⭐ ${p.rating}</div>
        <div class="product-price">${formatINR(p.price)}</div>
        ${hasEMI ? `<div class="product-emi-hint">No-Cost EMI from <strong>${formatINR(Math.round(p.price / 12))}/mo</strong> for 12 months</div>` : ''}
        <button class="product-add" onclick="event.stopPropagation(); addToCart(${JSON.stringify(p).replace(/"/g, '&quot;')})">
          <i class="fa-solid fa-cart-plus"></i> Add to Cart
        </button>
      </div>
    `;
  }).join('');
}

// === PDP (Product Detail Page) ===
async function openPDP(product) {
  pdpProduct = product;
  document.getElementById('pdpOverlay').classList.add('active');
  
  // Show product info
  document.getElementById('pdpEmoji').textContent = product.emoji;
  document.getElementById('pdpName').textContent = product.name;
  document.getElementById('pdpMeta').textContent = `${product.brand} · ${product.subcategory} · ⭐ ${product.rating}`;
  document.getElementById('pdpPrice').textContent = formatINR(product.price);
  document.getElementById('pdpAddBtn').onclick = () => { addToCart(product); closePDP(); };

  // Fetch applicable offers for this single product as a "cart"
  document.getElementById('pdpOffers').innerHTML = '<div class="pdp-no-offers">Checking available offers…</div>';
  
  try {
    const { data } = await apiCall('POST', '/api/offers/available', {
      cart: { amount: product.price, items: [{ sku_id: product.sku_id, price: product.price, qty: 1, category: product.category, brand: product.brand }] },
      customer: { customer_id: 'pdp_user', segments: ['new'], total_orders: 0, per_customer_used: 0 },
    });
    pdpOffers = [...(data.coupons || []), ...(data.auto_offers || [])];
    renderPDPOffers(product);
  } catch (e) {
    document.getElementById('pdpOffers').innerHTML = '<div class="pdp-no-offers">Could not load offers</div>';
  }
}

function renderPDPOffers(product) {
  const container = document.getElementById('pdpOffers');
  const eligible = pdpOffers.filter(o => o.is_eligible);
  
  if (eligible.length === 0) {
    container.innerHTML = '<div class="pdp-no-offers">No offers available for this product right now</div>';
    return;
  }

  // Add EMI section if electronics > ₹10,000
  let emiHtml = '';
  if (product.category === 'Electronics' && product.price > 10000) {
    const emi3 = formatINR(Math.round(product.price / 3));
    const emi6 = formatINR(Math.round(product.price / 6));
    const emi12 = formatINR(Math.round(product.price / 12));
    emiHtml = `
      <div class="pdp-offer-row">
        <div class="pdp-offer-icon emi"><i class="fa-solid fa-credit-card"></i></div>
        <div style="flex:1;">
          <div class="pdp-offer-name">No-Cost EMI Available</div>
          <div class="pdp-offer-desc">${emi3}/mo (3mo) · ${emi6}/mo (6mo) · ${emi12}/mo (12mo) — HDFC, ICICI, Axis, SBI</div>
        </div>
      </div>
    `;
  }

  let offersHtml = eligible.map(o => {
    const isAuto = o.type === 'auto_offer';
    const discount = o.discount.type === 'flat' ? formatINR(o.discount.value) + ' off' : o.discount.value + '% off';
    return `
      <div class="pdp-offer-row">
        <div class="pdp-offer-icon ${isAuto ? 'auto' : 'coupon'}">
          <i class="fa-solid ${isAuto ? 'fa-bolt' : 'fa-tag'}"></i>
        </div>
        <div style="flex:1;">
          <div class="pdp-offer-name">${o.title}</div>
          <div class="pdp-offer-desc">${o.code ? 'Code: ' + o.code + ' · ' : 'Auto-applied · '}${discount}</div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="pdp-offers-title"><i class="fa-solid fa-tags" style="color:var(--accent);"></i> Offers on this product</div>
    ${emiHtml}
    ${offersHtml}
  `;
}

function closePDP() {
  document.getElementById('pdpOverlay').classList.remove('active');
  pdpProduct = null;
}

// === Cart ===
function addToCart(product) {
  const existing = cart.find(i => i.sku_id === product.sku_id);
  if (existing) { existing.qty++; }
  else { cart.push({ ...product, qty: 1 }); }
  updateCartBadge();
  renderCart();
  refreshOffers();
  showToast(`${product.name} added to cart`, 'success');
}

function removeFromCart(skuId) {
  cart = cart.filter(i => i.sku_id !== skuId);
  updateCartBadge();
  renderCart();
  refreshOffers();
}

function changeQty(skuId, delta) {
  const item = cart.find(i => i.sku_id === skuId);
  if (item) {
    item.qty = Math.max(0, item.qty + delta);
    if (item.qty === 0) removeFromCart(skuId);
    updateCartBadge();
    renderCart();
    refreshOffers();
  }
}

function updateCartBadge() {
  const badge = document.getElementById('cartBadgeCount');
  const count = cart.reduce((s, i) => s + i.qty, 0);
  badge.textContent = count;
  badge.style.display = count > 0 ? 'inline-block' : 'none';
}

// === Cart rendering ===
function renderCart() {
  const cartEl = document.getElementById('cartItems');
  const subtotalEl = document.getElementById('cartSubtotal');
  const checkoutBtn = document.getElementById('checkoutBtn');
  
  if (cart.length === 0) {
    cartEl.innerHTML = '<div class="cart-empty">🛒 Your cart is empty<br>Click a product to add it</div>';
    subtotalEl.textContent = formatINR(0);
    if (checkoutBtn) checkoutBtn.disabled = true;
    document.getElementById('couponBox').style.display = 'none';
    document.getElementById('offersSection').innerHTML = '';
    document.getElementById('cartSummary').innerHTML = '';
    return;
  }

  if (checkoutBtn) checkoutBtn.disabled = false;
  document.getElementById('couponBox').style.display = 'block';

  cartEl.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-info">
        <div class="cart-item-name">${item.emoji} ${item.name}</div>
        <div class="cart-item-meta">${item.brand} · ${formatINR(item.price)}</div>
        <div class="cart-item-qty">
          <button class="qty-btn" onclick="changeQty('${item.sku_id}', -1)">−</button>
          <span style="font-size:13px;font-weight:600;">${item.qty}</span>
          <button class="qty-btn" onclick="changeQty('${item.sku_id}', 1)">+</button>
        </div>
      </div>
      <div class="cart-item-price">${formatINR(item.price * item.qty)}</div>
      <button class="cart-item-remove" onclick="removeFromCart('${item.sku_id}')">×</button>
    </div>
  `).join('');
  subtotalEl.textContent = formatINR(getCartTotal());
}

// === Offers in cart ===
async function refreshOffers() {
  if (cart.length === 0) { availableOffers = []; renderOffers(); renderSummary(); return; }
  try {
    const { data } = await apiCall('POST', '/api/offers/available', {
      cart: getCartPayload(),
      customer: { customer_id: 'playground_user', segments: ['new'], total_orders: 0, per_customer_used: 0 },
    });
    availableOffers = [...(data.coupons || []), ...(data.auto_offers || [])];
    renderOffers();
    renderSummary();
  } catch (e) { availableOffers = []; renderOffers(); renderSummary(); }
}

function renderOffers() {
  const offersEl = document.getElementById('offersSection');
  if (cart.length === 0 || availableOffers.length === 0) { offersEl.innerHTML = ''; return; }

  let html = `<div class="offers-title">Available Offers (${availableOffers.filter(o => o.is_eligible).length})</div>`;
  for (const offer of availableOffers) {
    const isEligible = offer.is_eligible;
    const isApplied = appliedOffers.has(offer._id);
    const isAuto = offer.type === 'auto_offer';
    const discount = offer.discount.type === 'flat' ? formatINR(offer.discount.value) + ' off' : offer.discount.value + '% off';
    const reason = offer.evaluation_result?.reason;

    html += `
      <div class="offer-card ${isApplied ? 'applied' : ''} ${!isEligible ? 'offer-not-eligible' : ''}" ${isEligible ? `onclick="toggleOffer('${offer._id}')"` : ''}>
        <div class="offer-card-header">
          <div class="offer-card-title">
            <div class="offer-icon ${isAuto ? 'auto' : 'coupon'}">
              <i class="fa-solid ${isAuto ? 'fa-bolt' : 'fa-tag'}"></i>
            </div>
            <div>
              <div class="offer-name">${offer.title}${!isEligible ? ' <span style="font-size:10px;color:var(--danger);">(not eligible)</span>' : ''}</div>
              <div class="offer-desc">${offer.code || 'Auto'} · ${discount}${reason ? ' · ' + reason : ''}</div>
            </div>
          </div>
          ${isEligible ? `<div class="offer-toggle ${isApplied ? 'active' : ''}"></div>` : ''}
        </div>
      </div>
    `;
  }
  offersEl.innerHTML = html;
}

function toggleOffer(offerId) {
  if (appliedOffers.has(offerId)) appliedOffers.delete(offerId);
  else appliedOffers.add(offerId);
  renderOffers();
  renderSummary();
}

// === Coupon ===
async function applyCoupon(code) {
  if (!code || cart.length === 0) return;
  const { status, data } = await apiCall('POST', '/api/offers/validate', {
    code: code.toUpperCase(), cart: getCartPayload(),
    customer: { customer_id: 'playground_user', segments: ['new'], total_orders: 0, per_customer_used: 0 },
  });
  if (status === 200 && data.valid) {
    appliedCoupon = { code: code.toUpperCase(), discount: data.discount_amount };
    showToast(`✓ ${code.toUpperCase()} applied — ${formatINR(data.discount_amount)} off`, 'success');
    renderOffers();
    renderSummary();
  } else {
    showToast(`✗ ${data.error?.message || data.reason || 'Invalid coupon'}`, 'error');
  }
}

// === Summary ===
function renderSummary() {
  if (cart.length === 0) { document.getElementById('cartSummary').innerHTML = ''; return; }
  const subtotal = getCartTotal();
  let totalDiscount = 0;

  for (const offer of availableOffers) {
    if (appliedOffers.has(offer._id) && offer.is_eligible) {
      totalDiscount += computeDiscount(offer, subtotal);
    }
  }
  if (appliedCoupon) totalDiscount += appliedCoupon.discount;

  const finalAmount = Math.max(0, subtotal - totalDiscount);
  let html = `<div class="summary-row"><span>Subtotal</span><span>${formatINR(subtotal)}</span></div>`;
  if (appliedCoupon) html += `<div class="summary-row discount"><span>${appliedCoupon.code}</span><span>−${formatINR(appliedCoupon.discount)}</span></div>`;
  for (const offer of availableOffers) {
    if (appliedOffers.has(offer._id) && offer.is_eligible && offer.type === 'auto_offer') {
      const disc = computeDiscount(offer, subtotal);
      if (disc > 0) html += `<div class="summary-row discount"><span>${offer.title}</span><span>−${formatINR(disc)}</span></div>`;
    }
  }
  html += `<div class="summary-total"><span>Total</span><span>${formatINR(finalAmount)}</span></div>`;
  if (totalDiscount > 0) html += `<div class="summary-savings"><i class="fa-solid fa-arrow-trend-down"></i> You save ${formatINR(totalDiscount)}</div>`;
  html += `<button class="checkout-btn" id="checkoutBtn" onclick="proceedToCheckout()">Proceed to Checkout →</button>`;
  document.getElementById('cartSummary').innerHTML = html;
}

function computeDiscount(offer, cartAmount) {
  if (offer.discount.type === 'flat') return Math.min(offer.discount.value, cartAmount);
  const pct = Math.round((cartAmount * offer.discount.value) / 100);
  return offer.discount.max_discount ? Math.min(pct, offer.discount.max_discount) : pct;
}

// === Checkout — redirect to hosted checkout ===
async function proceedToCheckout() {
  if (cart.length === 0) return;
  const btn = document.getElementById('checkoutBtn');
  btn.innerHTML = '<span class="spinner"></span> Creating checkout…';
  btn.disabled = true;
  try {
    const { data } = await apiCall('POST', '/api/checkout/sessions', {
      cart: getCartPayload(),
      redirect_urls: { success: window.location.origin + '?status=success', cancel: window.location.origin + '?status=cancel' },
      customer: {},
    });
    showToast('Redirecting to checkout…', 'success');
    setTimeout(() => { window.location.href = `${CHECKOUT_BASE}/${data.session_id}`; }, 600);
  } catch (e) {
    showToast('Checkout failed: ' + e.message, 'error');
    btn.innerHTML = 'Proceed to Checkout →';
    btn.disabled = false;
  }
}

// === Merchant Panel ===
function logApiCall(method, path, status, elapsed) {
  const logEl = document.getElementById('apiLog');
  if (!logEl) return;
  // Remove placeholder
  if (logEl.children.length === 1 && logEl.children[0].style.color) logEl.innerHTML = '';
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = `<span class="log-method ${method}">${method}</span> ${path} <span class="log-status ${status < 400 ? 'ok' : 'err'}">${status}</span> <span style="color:var(--text-muted)">${elapsed}ms</span>`;
  logEl.prepend(entry);
  while (logEl.children.length > 15) logEl.removeChild(logEl.lastChild);
}

// === UI helpers ===
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast ' + type + ' show';
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function setMode(mode) {
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  document.getElementById('merchantPanel').style.display = mode === 'merchant' ? 'block' : 'none';
}

// === Init ===
document.getElementById('apiKeyInput').addEventListener('input', (e) => { apiKey = e.target.value.trim(); });
document.getElementById('couponInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); applyCoupon(e.target.value); e.target.value = ''; }
});
document.getElementById('couponApplyBtn').addEventListener('click', () => {
  const input = document.getElementById('couponInput');
  applyCoupon(input.value); input.value = '';
});

// Check URL for success/cancel redirect from checkout
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('status') === 'success') {
  showToast('🎉 Order placed successfully! Payment confirmed.', 'success');
  // Clear cart
  cart = []; appliedOffers.clear(); appliedCoupon = null;
  updateCartBadge(); renderCart(); refreshOffers();
}
if (urlParams.get('status') === 'cancel') {
  showToast('Checkout cancelled. Your cart is saved.', 'error');
}

renderProducts();
renderCart();
updateCartBadge();
