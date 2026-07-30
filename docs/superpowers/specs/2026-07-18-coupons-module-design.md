# Fuse — Coupons Module PRD

> **Date:** 2026-07-18  
> **Status:** Draft  
> **Author:** @ArelliGoutham 
> **Module:** Coupons & Auto-Applied Offers (Module 1 of Fuse platform)

---

## 1. Product Vision

Fuse is a modular offers platform for Indian e-commerce. It sits between "customer sees price" and "customer pays" — showing applicable offers at checkout, validating them, and resolving stacking conflicts.

The platform is designed as a modular system where each offer type (coupons, bank offers, brand offers, EMI offers) is an independent plugin. **Module 1** delivers merchant-created coupons and auto-applied offers with combo/conflict resolution.

### 1.1 One Sentence

A drop-in offers layer that lets merchants create coupons and auto-applied discounts, handles all the rule logic and stacking conflicts, and exposes a clean API for checkout integration — without the merchant building anything.

### 1.2 What Fuse Is NOT

| Not this | Because |
|---|---|
| A payment gateway | We don't process transactions |
| A checkout page | Merchants already have one |
| A lending platform | We don't lend money |
| A coupon aggregator (like CouponDunia) | We're embedded in checkout, not a standalone site |
| A third-party-validated offer platform (v1) | No "Pay via BHIM UPI for ₹20 off" — that needs external validation. Deferred to future modules. |

### 1.3 Long-Term Platform Vision

```
Fuse Platform
  ├── Module 1: Coupons & Auto-Applied Offers        ← THIS SPEC
  ├── Module 2: Bank Offers (card BIN validation)
  ├── Module 3: Brand Offers (brand-subsidized discounts, e.g., Apple on iPhones)
  ├── Module 4: EMI Offers (EMI engine from original brief)
  └── Future: Payment-method offers, loyalty offers, personalization
```

Each module is a new `OfferEvaluator` plugin. The core rule engine and combo resolver are shared across all modules.

---

## 2. Problem Statement

### 2.1 Current State

Indian e-commerce merchants need to offer discounts and coupons at checkout. Today:

```
Merchant wants coupons at checkout
  │
  ├── Option A: Build it themselves
  │   ├── Coupon logic (flat, percentage, capped, min cart)
  │   ├── Stacking rules (what combines with what)
  │   ├── Per-customer limits, first-time buyer checks
  │   ├── Product/category restrictions
  │   ├── Time/window restrictions (weekend, flash sale)
  │   ├── Analytics on redemption and conversion
  │   └── Maintenance as rules get more complex
  │
  ├── Option B: Platform's built-in coupons (Shopify/WooCommerce)
  │   ├── Very basic — flat or percentage only
  │   ├── No auto-applied offers
  │   ├── No stacking/combo logic
  │   ├── No product-combo rules
  │   ├── No customer segment rules
  │   └── No analytics beyond "how many times used"
  │
  └── Option C: Do nothing
      └── Miss conversion uplift from targeted discounts
```

### 2.2 The Gap

Nobody owns the offers layer between "customer sees price" and "customer pays" with proper rule logic, stacking resolution, and analytics — in a way that any merchant can integrate via API without building it themselves.

### 2.3 Why Now

- Indian D2C is growing rapidly; merchants need sophisticated offer tools
- Platform-native coupons are too basic for mid-market merchants
- Building coupon logic in-house takes 2-3 sprints and ongoing maintenance
- The modular architecture lets us start with coupons and expand to bank/brand/EMI offers

---

## 3. Target Users

### 3.1 Primary: Merchant (Store Owner/Operator)

- Runs an online store (Shopify, WooCommerce, custom)
- Revenue: ₹5L–5Cr/month
- Wants to create coupons and auto-offers without engineering effort
- Needs analytics to understand which offers convert
- Integrates Fuse API into their checkout flow

### 3.2 Secondary: Merchant's Customer (Shopper)

- Shopping at the merchant's store
- Sees available offers at checkout
- Enters coupon codes or clicks auto-applied offers
- Expects fast, accurate discount calculation

### 3.3 Tertiary: Merchant's Developer

- Integrates Fuse API into the merchant's checkout
- Needs clear API docs, predictable responses, and webhooks
- Wants minimal integration effort (a few API calls)

---

## 4. Goals & Success Metrics

### 4.1 Goals

1. **Merchant can create and manage coupons/offers** via dashboard or API
2. **Merchant's checkout can discover, validate, and apply offers** via API
3. **System resolves stacking/conflicts** per merchant-defined policies
4. **System tracks redemptions and conversions** for analytics
5. **Architecture is modular** — bank/brand/EMI offers slot in without rework

### 4.2 Success Metrics (v1)

| Metric | Target | How to measure |
|---|---|---|
| Merchant activation | 10 beta merchants onboarded | Manual outreach, free tier |
| API response time | < 100ms p95 for /validate and /apply | APM monitoring |
| Rule accuracy | 100% — no wrong discounts applied | Integration test suite |
| Merchant integration time | < 2 hours for a developer | Beta merchant feedback |
| Coupon redemption rate | Measurable per merchant | /analytics endpoints |
| Conversion uplift | Trackable AOV with/without offers | /analytics/overview |

### 4.3 Non-Goals (v1)

- Embeddable widget (deferred to next iteration)
- Shopify/WooCommerce app plugins
- Bank offers, brand offers, EMI offers
- Third-party-validated offers (BHIM UPI, etc.)
- Cross-merchant customer analytics
- White-label branding

---

## 5. Functional Requirements

### 5.1 Merchant Dashboard

**5.1.1 Offer Management**
- Create coupon (with code) or auto-offer (no code)
- Configure discount: flat amount or percentage (with optional max cap)
- Set validity window: start date, end date
- Set usage limits: total usage, per-customer usage
- Configure rules (see 5.3)
- Set stacking behavior: global policy + per-offer overrides
- Activate/deactivate offers
- View offer list with filters (type, status, date range)

**5.1.2 Product Catalog Management**
- Sync products via API (individual or bulk upsert)
- View product list (search, filter by category/brand)
- Define product combos (bundles for combo rules)
- Products stored: SKU ID, name, category, subcategory, brand, attributes
- Product prices NOT stored — merchant's cart provides prices per-request

**5.1.3 Customer Management**
- View customer list (per-merchant, never cross-merchant)
- View customer segments (auto-computed + custom)
- View per-customer offer usage
- Exclude specific customers from specific offers (optional)

**5.1.4 Analytics**
- Overview: total redemptions, conversion rate, revenue lift, AOV with/without offers
- Per-offer: redemptions, conversions, revenue impact, top customer segments
- Per-customer segment: count, avg order value, redemption rate
- Time-series: redemption/conversion trends over time

**5.1.5 Settings**
- Global stacking policy configuration
- API key management
- Webhook configuration (for conversion tracking callbacks)

### 5.2 API (Checkout Integration)

The merchant's checkout calls these endpoints to show, validate, and apply offers.

**5.2.1 Discover Available Offers**
- `POST /api/offers/available`
- Input: cart (amount, items) + customer (email/phone/external_id)
- Output: list of applicable coupons and auto-offers, each marked eligible/ineligible with reason
- Use: merchant's checkout displays available offers to the customer

**5.2.2 Validate a Coupon Code**
- `POST /api/offers/validate`
- Input: code + cart + customer
- Output: valid/invalid, offer details, computed discount, reason if invalid
- Use: customer enters a code, merchant checks if it's valid before applying

**5.2.3 Apply an Offer**
- `POST /api/offers/apply`
- Input: code (for coupons) or offer_id (for auto-offers) + cart + customer + session_id
- Output: applied offer, discount amount, final amount, full stack after combo resolution
- Side effect: creates a redemption record with status "applied"

**5.2.4 Apply Multiple Offers (Stacking)**
- `POST /api/offers/apply/batch`
- Input: offer_ids[] + cart + customer + session_id
- Output: applied[] (with discounts), rejected[] (with reasons), total_discount, final_amount
- Use: customer tries to stack offers; ComboResolver decides what's allowed

**5.2.5 Track Conversion**
- `POST /api/track/conversion`
- Input: session_id, order_id, order_value, status (paid/abandoned)
- Output: tracked: true
- Use: merchant calls after payment completes or cart is abandoned

### 5.3 Rule System

Rules are composable conditions attached to offers. Each offer can have zero or more rules. All rules must pass for an offer to be eligible.

**5.3.1 Supported Rule Types (v1)**

| Rule Type | Config | Description |
|---|---|---|
| `min_cart_value` | `{ min_amount: 500 }` | Cart total must be ≥ min_amount |
| `max_cart_value` | `{ max_amount: 100000 }` | Cart total must be ≤ max_amount |
| `customer_segment` | `{ segments: ["new", "vip"] }` | Customer must be in one of the segments |
| `first_time_buyer` | `{}` | Customer has zero paid orders with this merchant |
| `per_customer_limit` | `{ limit: 2 }` | Customer has used this offer < limit times |
| `total_usage_limit` | `{ limit: 1000 }` | Total redemptions < limit |
| `category_restriction` | `{ categories: ["electronics"], exclude: false }` | Cart must (or must not) contain items in these categories |
| `product_restriction` | `{ skus: ["SKU-123"], exclude: false }` | Cart must (or must not) contain these SKUs |
| `brand_restriction` | `{ brands: ["Apple"], exclude: false }` | Cart must (or must not) contain these brands |
| `product_combo` | `{ skus: ["SKU-1", "SKU-2"] }` | All specified SKUs must be present in cart |
| `time_window` | `{ days: ["sat","sun"], start_hour: 0, end_hour: 23 }` | Valid only during specified days/hours |
| `weekend_only` | `{}` | Valid only on Saturday and Sunday |
| `date_range` | `{ start_date: "...", end_date: "..." }` | Valid only within date range |

**5.3.2 Rule Evaluation**

- Rules are evaluated as AND — all must pass
- First failing rule provides the rejection reason (human-readable)
- Rule evaluators are pure functions: `(rule_config, context) → boolean`
- Per-customer and total-usage rules require async lookups (customer_offers, offer.usage_count) — resolved before evaluation and passed in context

### 5.4 Combo/Stacking Resolution

**5.4.1 Global Stacking Policy (merchant-level)**

```
{
  max_coupons: 1,               // max coupon codes per order
  max_auto_offers: 1,           // max auto-applied offers
  max_total_discount: null,     // optional cap on total discount amount
  allow_cross_type: true,       // can a coupon + auto-offer stack?
  exclusive_tags: ["flash"]     // offers with these tags can't stack with anything
}
```

**5.4.2 Per-Offer Override**

Each offer can declare:
```
{
  stacks_with: ["auto_offer"],  // only stacks with these types (null = stacks with all)
  exclusive: true,              // if true, no other offers can stack with this one
  priority: 1                   // higher priority evaluated first
}
```

**5.4.3 Resolution Algorithm**

1. Sort eligible offers by priority (exclusive offers first, then by discount descending)
2. If an exclusive offer is selected, reject all others
3. Enforce global limits: max_coupons, max_auto_offers
4. If `!allow_cross_type`, only one offer type allowed total
5. Check per-offer `stacks_with` restrictions
6. Sum discounts, enforce `max_total_discount` cap if set
7. Return applied offers + rejected offers (with reasons)

### 5.5 Customer Identity

**5.5.1 Global Customer Model**

- Customers are global across all merchants — one person, one identity
- Resolved by email or phone (unique sparse indexes)
- When a merchant passes a customer identifier, the system:
  1. Looks up global `customers` by email/phone → reuse if found
  2. Creates if not found
  3. Looks up `merchant_customers` for {merchant_id, customer_id} → load context or create
- Merchants never see another merchant's customer data

**5.5.2 Auto-Computed Segments**

| Segment | Condition |
|---|---|
| `new` | 0 paid orders with this merchant |
| `returning` | 1+ paid orders with this merchant |
| `vip` | Total revenue with this merchant > merchant-defined threshold |

Merchants can also add custom segments via dashboard.

**5.5.3 Tenant Isolation Invariant**

> All data access is scoped by `merchant_id` derived from API key authentication. No API endpoint returns data belonging to another merchant. The global `customers` collection is internal-only — merchants interact only with their `merchant_customers` relationship records.

---

## 6. Technical Architecture

### 6.1 System Architecture

```
┌─────────────────────────────────────────────────────┐
│             MERCHANT DASHBOARD (Next.js)              │
│  Create coupons · Set rules · Global stacking policy  │
│  View redemptions · Manage products · Analytics       │
└──────────────────────┬──────────────────────────────┘
                       │ REST API (x-api-key auth)
┌──────────────────────▼──────────────────────────────┐
│                  API LAYER (Fastify)                  │
│  /offers   /coupons   /validate   /apply   /track    │
│  /products /product-combos   /analytics              │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│              RULE ENGINE (core)                       │
│                                                       │
│  OfferEvaluatorRegistry                               │
│    ├── CouponEvaluator      (v1 — code-based)         │
│    ├── AutoOfferEvaluator   (v1 — cart-data-driven)   │
│    ├── BankOfferEvaluator   (v2 — card BIN, future)   │
│    ├── BrandOfferEvaluator  (v2 — brand validation)   │
│    └── ...                                             │
│                                                       │
│  ComboResolver — applies stacking policy + conflicts  │
│  RuleEvaluators — pure functions per rule type        │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│              DATA LAYER (MongoDB Atlas)               │
│  merchants · offers · products · product_combos      │
│  customers · merchant_customers · customer_offers    │
│  redemptions                                          │
└──────────────────────────────────────────────────────┘
```

### 6.2 Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Dashboard frontend | Next.js + React + Tailwind | Aligns with brief, full-stack JS, fast dev |
| Backend API | Node.js + Fastify | Fast, schema validation built-in, lightweight |
| Database | MongoDB Atlas (free tier) | Document model fits offers naturally, JSON rules, zero infra cost for v1 |
| Caching / Rate limiting | Redis (or in-memory for v1) | Bank data cache, rate limit sliding window |
| Hosting (frontend) | Vercel |_ZERO config for Next.js |
| Hosting (backend) | Railway or Fly.io | Simple deploy, free tier available |
| CDN | Cloudflare | For future widget.js distribution |

### 6.3 Data Model (MongoDB)

```
merchants (collection)
  _id, name, email, api_key, plan
  global_stacking_policy: {
    max_coupons, max_auto_offers, max_total_discount,
    allow_cross_type, exclusive_tags
  }
  created_at

offers (collection)
  _id, merchant_id
  code (nullable — null for auto-offers)
  type: "coupon" | "auto_offer"  (extensible)
  title, description
  discount: {
    type: "flat" | "percentage",
    value: Number,
    max_discount: Number (nullable)
  }
  subsidy_model: "merchant" | "bank" | "brand" | "split"
  status: "active" | "inactive" | "expired"
  validity: { starts_at, ends_at }
  usage_limits: { total: Number (nullable), per_customer: Number (nullable) }
  usage_count: 0  (denormalized)
  rules: [
    { rule_type: "min_cart_value", config: { min_amount: 500 } },
    { rule_type: "customer_segment", config: { segments: ["new"] } },
    ...
  ]
  stacking: {
    stacks_with: ["auto_offer"]  (nullable = stacks with all),
    exclusive: boolean,
    priority: Number
  }
  tags: ["flash", "holiday"]  (for exclusive_tags matching)
  created_at, updated_at

products (collection)
  _id, merchant_id
  sku_id (unique per merchant)
  name, category, subcategory (nullable), brand (nullable)
  parent_sku (nullable — for variants)
  attributes: {} (flexible key-value)
  status: "active" | "inactive"
  created_at, updated_at

product_combos (collection)
  _id, merchant_id
  name, description
  product_skus: ["SKU-1", "SKU-2"]
  created_at

customers (collection — GLOBAL IDENTITY)
  _id
  email (unique sparse index)
  phone (unique sparse index)
  first_seen_at
  created_at, updated_at

merchant_customers (collection — MERCHANT-CUSTOMER RELATIONSHIP)
  _id, merchant_id, customer_id
  external_id (merchant's internal customer ID)
  segments: ["new", "returning", "vip"]
  total_orders, total_revenue  (within this merchant only)
  first_seen_at
  created_at, updated_at

customer_offers (collection — ELIGIBILITY & USAGE)
  _id, customer_id, offer_id, merchant_id
  status: "eligible" | "used" | "expired" | "excluded"
  times_used: 0
  first_used_at (nullable), last_used_at (nullable)
  expires_at (nullable)

redemptions (collection)
  _id, offer_id, merchant_id, session_id
  cart_amount, discount_applied, final_amount
  customer_id (internal — references customers._id, nullable if customer unknown)
  customer_input (what merchant passed: email/phone/external_id — for traceability)
  applied_at
  order_id (nullable)
  order_status: "applied" | "paid" | "abandoned"
```

**Indexes:**
- `offers`: `{ merchant_id: 1, code: 1 }`, `{ merchant_id: 1, status: 1 }`
- `products`: `{ merchant_id: 1, sku_id: 1 }` (unique), `{ merchant_id: 1, category: 1 }`
- `customers`: `{ email: 1 }` (unique sparse), `{ phone: 1 }` (unique sparse)
- `merchant_customers`: `{ merchant_id: 1, customer_id: 1 }` (unique)
- `customer_offers`: `{ customer_id: 1, offer_id: 1 }`, `{ merchant_id: 1, status: 1 }`
- `redemptions`: `{ offer_id: 1, applied_at: -1 }`, `{ session_id: 1 }`, `{ merchant_id: 1, applied_at: -1 }`

### 6.4 API Design

**Auth:** All endpoints require `x-api-key` header → resolves to `merchant_id`.

```
# ─── OFFER MANAGEMENT ───
POST   /api/offers              — create coupon or auto-offer
GET    /api/offers              — list (filter: type, status, date)
GET    /api/offers/:id          — get one
PATCH  /api/offers/:id          — update
DELETE /api/offers/:id          — delete

# ─── CHECKOUT (customer-facing) ───
POST   /api/offers/available    — discover all applicable offers for cart+customer
POST   /api/offers/validate     — validate a specific coupon code
POST   /api/offers/apply        — apply single offer (code or offer_id)
POST   /api/offers/apply/batch  — apply multiple (stacking resolution)

# ─── TRACKING ───
POST   /api/track/conversion    — update redemption with order status

# ─── ANALYTICS ───
GET    /api/analytics/overview  — summary metrics
GET    /api/analytics/offers    — per-offer breakdown
GET    /api/analytics/customers — per-segment breakdown

# ─── PRODUCT CATALOG ───
POST   /api/products            — create/update product
POST   /api/products/bulk       — bulk sync (upsert)
GET    /api/products            — list/search
GET    /api/products/:sku_id    — get one
DELETE /api/products/:sku_id    — remove

POST   /api/product-combos      — define combo
GET    /api/product-combos      — list combos
DELETE /api/product-combos/:id  — remove
```

### 6.5 Rule Engine Design

```
OfferEvaluatorRegistry
  ├── register(type, evaluator)
  ├── getEvaluator(type)
  └── evaluate(offer, context): EvaluationResult

interface OfferEvaluator {
  evaluate(offer, context): EvaluationResult
}

EvaluationContext = {
  cart: { amount, items: [{ sku_id, category, brand, price, qty }] },
  customer: { customer_id, merchant_customer, segments, total_orders },
  merchant: { stacking_policy },
  usage: { per_customer_used, total_used },
  now: Date
}

EvaluationResult = {
  eligible: boolean,
  matched_rules: string[],
  failed_rule?: string,
  reason?: string,
  discount: { type, value, amount }
}

RuleEvaluators = {
  min_cart_value, max_cart_value, customer_segment,
  first_time_buyer, per_customer_limit, total_usage_limit,
  category_restriction, product_restriction, brand_restriction,
  product_combo, time_window, weekend_only, date_range
}
// Each: (rule_config, context) → boolean (pure function)
```

### 6.6 Combo Resolver Design

```
ComboResolver.resolve(
  offers: EvaluationResult[],
  policy: StackingPolicy,
  cart: Cart
): ComboResult

Resolution:
  1. Sort by priority (exclusive first, then discount desc)
  2. If exclusive offer selected → reject all others
  3. Enforce global limits (max_coupons, max_auto_offers)
  4. Check allow_cross_type
  5. Check per-offer stacks_with restrictions
  6. Sum discounts, enforce max_total_discount cap
  7. Return applied[] + rejected[] + totals
```

### 6.7 Error Handling

```
Error envelope:
{
  error: { code, message, details? }
}

| Code | HTTP | When |
|---|---|---|
| AUTH_INVALID | 401 | Missing/invalid API key |
| OFFER_NOT_FOUND | 404 | Offer ID/code not found (or belongs to another merchant) |
| OFFER_INVALID | 422 | Code exists but expired/usage-limited |
| OFFER_INELIGIBLE | 422 | Cart/customer doesn't meet rules |
| COMBO_CONFLICT | 422 | Stacking policy forbids combination |
| VALIDATION_ERROR | 400 | Malformed request body |
| RATE_LIMITED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Unexpected failure |

Tenant isolation: all queries scoped by merchant_id from auth.
Cross-merchant IDs return 404 OFFER_NOT_FOUND (no information leakage).
```

### 6.8 Rate Limiting

| Endpoint type | Limit | Scope |
|---|---|---|
| Customer-facing (/available, /validate, /apply) | 100 req/min | Per API key |
| Management (/offers CRUD, /products) | 60 req/min | Per API key |
| Tracking (/track/conversion) | 200 req/min | Per API key |

### 6.9 Testing Strategy

**Unit tests:**
- Each rule evaluator: pass, fail, edge cases (boundary values, empty cart, no segments)
- Combo resolver: single offer, stackable, exclusive, global limits, cap, override
- Evaluators: all rules pass, one fails, no customer context

**Integration tests:**
- Full lifecycle: create → validate → apply → track conversion
- Stacking: apply two offers, verify combo resolution
- Tenant isolation: merchant A cannot access merchant B's data
- Customer resolution: same email across two merchants → one global customer, two merchant_customers
- Per-customer limit: apply 3x, 3rd rejected if limit is 2

**E2E golden path:**
1. Merchant creates "FLAT50" (min ₹500, max ₹40, first-time buyer)
2. Merchant syncs products
3. Checkout calls /available → sees FLAT50
4. /validate → valid, ₹40 off
5. /apply → redemption created
6. /track/conversion → status "paid"
7. /analytics/overview → sees redemption + conversion

**Framework:** Jest + Superagent for API integration tests.

---

## 7. Security & Privacy

### 7.1 Tenant Isolation

- Every database query is scoped by `merchant_id` from API key authentication
- No endpoint returns cross-merchant data
- Cross-merchant resource IDs return 404 (no existence leakage)

### 7.2 Customer Data

- Global customer identity (email/phone) is internal — merchants only see their merchant_customers relationship
- No cross-merchant customer analytics in v1
- Customer PII (email, phone) stored in MongoDB — encryption at rest (Atlas default)

### 7.3 API Key Security

- API keys are hashed at rest (bcrypt)
- Keys are merchant-scoped — one key per merchant (multiple keys in future)
- Keys passed via `x-api-key` header (never URL params)

### 7.4 Input Validation

- All request bodies validated via Fastify schema validation
- SQL/NoSQL injection prevention: parameterized queries, input sanitization
- Rate limiting on all endpoints

---

## 8. Build Phases

### Phase 1: Core Engine (Week 1-2)
- MongoDB schema + indexes
- Rule engine: OfferEvaluatorRegistry, CouponEvaluator, AutoOfferEvaluator
- All 13 rule evaluators as pure functions
- ComboResolver with stacking policy
- Unit tests for all rule evaluators and combo resolver

### Phase 2: API Layer (Week 2-3)
- Fastify server setup
- Offer management CRUD endpoints
- Checkout endpoints: /available, /validate, /apply, /apply/batch
- Tracking endpoint: /track/conversion
- Product catalog endpoints
- API key auth middleware
- Rate limiting
- Integration tests for full lifecycle

### Phase 3: Dashboard (Week 3-4)
- Next.js app setup
- Offer creation form (with rule builder UI)
- Offer list with filters
- Product catalog management page
- Analytics dashboard (overview, per-offer, per-segment)
- Settings page (stacking policy, API keys)
- Basic auth for merchant login

### Phase 4: Polish & Beta (Week 4-5)
- API documentation (OpenAPI spec)
- Integration guide for developers
- Playground/test page in dashboard
- Deploy to Railway/Vercel
- Onboard first beta merchant
- Fix issues from real usage

---

## 9. Future Modules (Out of Scope for v1)

| Module | What | Key dependency |
|---|---|---|
| Bank Offers | "Use Federal Bank CC → 10% off" | Card BIN validation, bank data |
| Brand Offers | "Apple subsidizes ₹2000 off iPhone" | Brand partnership, subsidy tracking |
| EMI Offers | EMI engine from original brief | EMI math, bank rates, widget |
| Embeddable Widget | Drop-in script tag + Shadow DOM | SDK + widget wrapper |
| Shopify App | OAuth install, Polaris UI | Shopify Partner account |
| WooCommerce Plugin | WordPress plugin | WP dev environment |
| Cross-merchant Personalization | Offers based on global shopping behavior | Privacy policy, opt-in |
| React/Next.js SDK | Headless SDK for custom UIs | Package build setup |

---

## 10. Open Questions

1. **Webhooks:** Should we send webhooks to merchants on redemption/conversion events, or is polling /analytics sufficient for v1?
2. **Coupon code generation:** Should the system auto-generate codes (e.g., "FLAT50-ABC123") or only use merchant-provided codes?
3. **Multi-currency:** v1 assumes INR only. Should we design for multi-currency from the start, or defer?
4. **Soft delete vs hard delete:** When a merchant deletes an offer, should we soft-delete (keep for analytics) or hard-delete?
5. **Concurrent apply:** If two checkouts apply the same coupon simultaneously and hit the usage limit, how do we handle the race? (Suggested: atomic increment with check, reject if over limit.)
