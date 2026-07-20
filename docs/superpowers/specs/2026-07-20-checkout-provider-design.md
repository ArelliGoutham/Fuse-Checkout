# OfferForge Checkout Provider — Design Spec

> **Date:** 2026-07-20
> **Status:** Draft
> **Module:** Checkout Provider with EMI Engine

---

## 1. Product Vision

OfferForge evolves from an offers API into a **hosted checkout provider** with a superior offers and EMI engine. Merchants create a checkout session via API → customers are redirected to our hosted checkout page → we handle cart display, customer info, offers (coupons + auto + EMI + payment-method offers), and payment via the merchant's configured PG → redirect back with order verification.

### 1.1 Positioning

"The checkout that sells more." OfferForge is a PG-agnostic checkout layer with a built-in offers engine that no standalone PG can match. We are not a payment gateway — we orchestrate the checkout experience and pass payment to the merchant's existing PG.

### 1.2 What OfferForge Owns

| Layer | OfferForge | PG (Razorpay/PineLabs/Cashfree) |
|---|---|---|
| Checkout UI | ✅ | ❌ |
| Customer info collection | ✅ | ❌ |
| Offer rules & configuration | ✅ | ❌ |
| EMI calculation | ✅ (own bank rate DB) | ❌ |
| Coupon engine | ✅ (existing) | ❌ |
| Payment offer logic | ✅ | ❌ |
| Bank interest rates | ✅ (admin-managed DB) | ❌ |
| Subsidy calculation | ✅ | ❌ |
| Payment processing | ❌ | ✅ |
| Bank agreements | ❌ | ✅ |
| Settlement | ❌ | ✅ |
| Refunds | ❌ | ✅ (Phase 2) |

### 1.3 Offer Type Hierarchy

```
Offer Types
├── Coupon (existing — code-based, customer enters code)
├── Auto-Offer (existing — cart-based, auto-applied)
├── EMI Offer (new — bank + tenure + subsidy, shown on card payment)
├── Payment Offer (new — payment-method-specific discounts)
│   ├── UPI Cashback ("₹50 cashback on UPI")
│   ├── Card Discount ("10% off HDFC Credit Card" — BIN-based)
│   ├── Net Banking Offer ("₹100 off ICICI NetBanking")
│   ├── Wallet Offer ("5% off Paytm wallet")
│   └── COD Offer ("₹0 COD fee on prepaid")
```

---

## 2. Architecture

### 2.1 Integration Flow

```
Merchant's Store
    │
    │  1. POST /api/checkout/sessions (cart + redirect URLs)
    │     → Returns { session_id, checkout_url }
    │
    ▼
checkout.offerforge.io/:session_id  (hosted by us)
    │
    │  2. Customer sees: cart + offers + customer form + payment methods
    │  3. OfferForge engine evaluates ALL applicable offers dynamically
    │  4. Customer pays → OfferForge calls PG with minimal payload
    │  5. Redirect → merchant's success URL → merchant verifies via API
    │
    ▼
Merchant's Store (success page)
```

### 2.2 Embedding Model

- **v1: Full-page redirect** — customer goes to `checkout.offerforge.io/:session_id`
- **v2 (future): Slide-over widget** — checkout opens as overlay on merchant's site
- **v3 (future): Inline embed** — checkout renders inside merchant's page
- Architecture supports all three — the checkout UI is a standalone web app that can be embedded in different ways

### 2.3 PG Integration (Internal)

```
src/modules/pg-adapters/
  types.ts              — PGAdapter interface
  razorpay-adapter.ts   — implements PGAdapter (Phase 1)
  pinelabs-adapter.ts   — implements PGAdapter (Phase 2)
  cashfree-adapter.ts   — implements PGAdapter (Phase 3)

interface PGAdapter {
  createOrder(amount, paymentMethod, options): Promise<PGOrder>
  processPayment(orderId, paymentData): Promise<PGPaymentResult>
  verifyPayment(paymentId): Promise<PGVerification>
}
```

The merchant configures which PG to use in their dashboard. OfferForge calls the PG adapter internally — the merchant never interacts with the PG directly from the checkout.

---

## 3. Data Model

### 3.1 New Collections

#### BankRates (admin-managed, merchants cannot edit)
```
_id
bank_name           — "HDFC", "ICICI", "SBI"
bank_code           — "HDFC" (for PG payload)
card_type           — "credit" | "debit"
interest_rate       — 18 (annual %)
tenures             — [3, 6, 9, 12, 18, 24]
processing_fee      — 199 (flat ₹, nullable)
min_amount          — 2500
max_amount          — null (or cap)
status              — "active" | "inactive"
updated_at          — last updated by admin
```

#### EMIOffers (merchant-configured)
```
_id, merchant_id
title               — "No-Cost EMI on iPhone 15"
product_skus        — ["SKU-IP15"] (null = all)
category_filter     — ["Electronics"] (null = all)
price_range         — { min: 50000, max: 200000 }
subsidy_model       — "merchant" | "brand" | "split"
subsidy_amount      — "full" (no-cost) | "partial" | number (max ₹)
banks               — ["HDFC", "ICICI"] (null = all)
tenures             — [3, 6, 9, 12]
emi_type            — "no_cost" | "low_cost" | "standard"
status, validity, created_at, updated_at
```

#### PaymentOffers (merchant-configured)
```
_id, merchant_id
title               — "₹50 Cashback on UPI"
payment_method      — "upi" | "card" | "netbanking" | "wallet" | "cod"
bank_filter         — "HDFC" (null = all banks)
bin_filter          — ["4591"] (null = all BINs)
discount_type       — "flat" | "percentage" | "cashback"
discount_value      — 50
max_discount        — null
min_cart_value      — 0
rules               — [same rule structure as coupons]
status, validity, created_at, updated_at
```

#### CheckoutSessions (temporary — expire in 30 min)
```
_id
merchant_id
cart                — { amount, items: [{ sku_id, name, price, qty, category, brand }] }
customer_info       — { name, email, phone, address } (null initially)
applied_offers      — [{ offer_id, type, discount_amount }]
payment_method      — null until selected
payment_status      — "pending" | "processing" | "success" | "failed"
pg_transaction_id   — null until PG processes
order_id            — generated on success
redirect_urls       — { success: "...", cancel: "..." }
created_at, expires_at
```

#### Orders (permanent — created on successful payment)
```
_id, merchant_id, session_id
cart_amount
total_discount
final_amount
customer_info       — { name, email, phone, address }
applied_offers      — [{ offer_id, type, discount_amount }]
payment_method
pg_transaction_id, pg_name
order_status         — "created" | "paid" | "failed" | "refunded"
emi_details         — { bank, tenure, emi_amount, interest, subsidy } (if EMI)
created_at
```

### 3.2 Existing Collections (unchanged)
- `merchants` — add `pg_config: { provider, api_key, api_secret }`
- `offers` — existing coupon/auto-offer collections stay as-is
- `products`, `redemptions`, `users`, `merchant_users` — unchanged

---

## 4. API Design

### 4.1 Checkout Sessions (merchant calls)

```
POST   /api/checkout/sessions
       Body: { cart, redirect_urls: { success, cancel }, customer?: { email?, phone? } }
       Returns: { session_id, checkout_url }
       Auth: API key or JWT

GET    /api/checkout/sessions/:id
       Returns: full session state
       Auth: API key or JWT (merchant-scoped)
```

### 4.2 Checkout Page Endpoints (called by checkout.offerforge.io)

```
GET    /api/checkout/:session_id/cart
       Returns: cart, merchant branding, subtotal

POST   /api/checkout/:session_id/customer
       Body: { name, email, phone, address: { line1, city, state, pincode } }
       Returns: { saved: true }

GET    /api/checkout/:session_id/offers
       Returns: {
         coupons: [{ offer, is_eligible, reason? }],
         auto_offers: [{ offer, is_eligible, reason? }],
         payment_offers: { upi: [...], card: [...], netbanking: [...], wallet: [...], cod: [...] },
         emi_offers: [...]
       }

POST   /api/checkout/:session_id/apply-coupon
       Body: { code }
       Returns: { valid, discount_amount, final_amount }

POST   /api/checkout/:session_id/select-payment
       Body: { method, bank?, bin?, tenure?, emi_offer_id? }
       Returns: { applicable_offers, final_amount, payment_instructions }

POST   /api/checkout/:session_id/process-payment
       Body: { method, payment_data }
       Returns: { order_id, redirect_url }
       Side effect: calls PG adapter, creates Order if successful
```

### 4.3 Orders (merchant verifies after redirect)

```
GET    /api/orders/:id
       Returns: full order with customer, payment, offers
       Auth: API key or JWT (merchant-scoped)

GET    /api/orders
       Query: ?status=paid&page=1&limit=20
       Returns: { orders, total, page }
```

### 4.4 Bank Rates (admin only)

```
GET    /api/admin/bank-rates
POST   /api/admin/bank-rates
PATCH  /api/admin/bank-rates/:id
       Auth: admin JWT (merchants can view via GET but not modify)
```

### 4.5 EMI Offers (merchant configures)

```
POST   /api/emi-offers
GET    /api/emi-offers
       Auth: JWT (offer_manager+ role)
```

### 4.6 Payment Offers (merchant configures)

```
POST   /api/payment-offers
GET    /api/payment-offers
       Auth: JWT (offer_manager+ role)
```

---

## 5. EMI Calculation Engine

### 5.1 Formula (Reducing Balance)

```
EMI = P × r × (1+r)^n / ((1+r)^n - 1)

P = Principal (product price minus upfront discount)
r = Monthly interest rate = annual_rate / 12 / 100
n = Tenure in months
```

### 5.2 EMI Types

| Type | Who pays interest | Customer sees | Merchant subsidy |
|---|---|---|---|
| Standard | Customer | EMI with interest | ₹0 |
| No-Cost | Merchant (full) | EMI = P/n, 0% interest | = total interest |
| Low-Cost | Shared | EMI with reduced interest | = configured subsidy amount (capped at total interest) |

### 5.3 Calculation Flow

1. Customer enters card → BIN lookup → bank identified (e.g., "HDFC")
2. OfferForge looks up BankRates for HDFC CC → { rate: 18%, tenures: [3,6,9,12] }
3. OfferForge finds matching EMIOffers for merchant + HDFC + cart products
4. For each tenure, calculate EMI using our formula + apply subsidy config
5. Display: monthly EMI, interest, total, processing fee, subsidy (hidden from customer)
6. Customer selects plan → OfferForge stores selection
7. Payment: OfferForge sends minimal payload to PG → `{ amount, payment_method: "CREDIT_EMI", bank, tenure }`
8. PG processes standard EMI on principal → customer's card statement shows EMI installments

### 5.4 What PG Receives

The PG gets a **minimal payload** — it does NOT know about offers, subsidies, or our calculation:
```json
{
  "amount": 129999,
  "payment_method": "CREDIT_EMI",
  "bank": "HDFC",
  "tenure": 6
}
```

The PG processes a standard EMI on the principal amount. The "no-cost" effect happens because the customer pays EMI on principal only (we don't add interest to the PG amount), and the merchant absorbs the interest difference.

---

## 6. Checkout UI Flow

### 5-step checkout:

1. **Cart Summary** — items, subtotal, applied offers, total
2. **Customer Details** — name, email, phone (OTP), shipping address
3. **Offers & Payment** — payment method selection with dynamic offers per method:
   - UPI → UPI cashback offer visible
   - Card → card BIN offers + EMI options appear on card entry
   - NetBanking → NB-specific offers
   - Wallet → wallet offers
   - COD → COD fee/offer
4. **Payment Processing** — PG-specific flow (UPI QR, card 3DS, bank redirect, COD confirm)
5. **Redirect** — customer → merchant success URL → merchant verifies via `GET /api/orders/:id`

### Dynamic offer behavior:
- Coupling coupon + auto-offer + payment offer → stacking policy applies
- EMI offers shown only when card detected (BIN lookup)
- Payment offers change as customer switches payment method
- Total recalculates in real-time

---

## 7. PG Adapter Integration

### 7.1 Supported PGs (by phase)

| Phase | PG | Why |
|---|---|---|
| v1 | Razorpay | Easiest integration, EMI auto-enabled, great docs |
| v2 | PineLabs | Deepest EMI (multi-party subvention, IMEI, down payment EMI) |
| v3 | Cashfree | Best API, eligibility endpoints, BIN lookup |

### 7.2 Merchant PG Configuration

Merchants configure their PG credentials in the dashboard:
```
merchant.pg_config = {
  provider: "razorpay",
  api_key: "rzp_live_...",
  api_secret: "..."
}
```

OfferForge uses these credentials to call the PG on behalf of the merchant. The merchant's existing PG account handles all bank relationships, settlements, and compliance.

---

## 8. Testing Strategy

### Unit tests:
- EMI calculation (standard, no-cost, low-cost) for various principals, rates, tenures
- Bank rate lookup
- BIN → bank mapping
- Payment offer eligibility per payment method
- Subsidy calculation (full, partial, capped)
- Rounding to whole rupees (last month adjustment)

### Integration tests:
- Create checkout session → load cart → apply coupon → select payment → process
- EMI offer display when card BIN detected
- Payment offer display per payment method toggle
- Order creation on successful payment
- Order verification via API
- Session expiry (30 min)
- Redirect URL handling

### Golden path E2E:
1. Merchant creates checkout session with cart
2. Customer loads checkout → sees cart + offers
3. Enters customer details
4. Applies FLAT50 coupon
5. Selects HDFC card → No-Cost EMI appears
6. Selects 6-month EMI → total recalculated
7. Payment processed (mock PG)
8. Order created → redirect to merchant
9. Merchant verifies order via API

---

## 9. Build Phases

### Phase 1: Checkout Foundation (Week 1-2)
- BankRates collection + admin CRUD
- EMI calculation engine (pure functions, TDD)
- CheckoutSessions collection + create/load APIs
- Hosted checkout page (cart → customer details → payment method selection)
- PG adapter interface + Razorpay adapter (mock for tests)
- Orders collection + verification API

### Phase 2: EMI & Payment Offers (Week 2-3)
- EMIOffers collection + merchant CRUD
- PaymentOffers collection + merchant CRUD
- EMI display on checkout (when card BIN detected)
- Payment offer display per payment method
- Subsidy calculation in checkout flow
- Dashboard: EMI section + Payment offers section

### Phase 3: PG Integration (Week 3-4)
- Razorpay adapter (real integration)
- Payment processing flow (UPI, card, netbanking, COD)
- Payment success/failure handling
- Redirect to merchant + order verification
- Golden path E2E test with real PG (test mode)

### Phase 4: Polish & Launch (Week 4-5)
- Checkout UI polish (animations, mobile responsive)
- Checkout analytics (funnel tracking)
- Dashboard: orders list, checkout analytics
- Playground: test checkout with mock PG
- Documentation: checkout integration guide

---

## 10. Future Roadmap (Out of Scope for v1)

- Slide-over widget mode (v2 embedding)
- Inline embed mode (v3 embedding)
- PineLabs adapter (multi-party subvention, IMEI validation, brand offers)
- Cashfree adapter
- Multi-PG orchestration (route to best PG per transaction)
- Refund handling
- Subscription/recurring checkout
- Shopify app (OAuth install)
- WooCommerce plugin
- Saved customer profiles (returning customer quick checkout)
- COD risk scoring
- Address verification
