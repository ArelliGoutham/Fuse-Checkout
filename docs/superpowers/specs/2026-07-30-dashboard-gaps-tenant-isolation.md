# Dashboard Gaps & Tenant Isolation Fix — Design Spec

> **Date:** 2026-07-30
> **Phase:** Phase 2
> **Status:** Brainstormed — Awaiting Approval
> **Depends on:** All Phase 2 backend work (transactions, refunds, subsidies, OEM adapters, EMI campaigns, PG credentials)

---

## Problem Statement

Fuse has comprehensive backend APIs but the merchant dashboard is missing UI for 7 critical features. Additionally, 3 settlement endpoints have tenant isolation gaps that allow cross-merchant access.

---

## Part 1: Tenant Isolation Fixes

### Issue
Three subsidy settlement endpoints don't verify `merchant_id` before operating on ledger entries:

1. `POST /api/subsidy/:order_id/imei` — captures IMEI for any merchant's order
2. `POST /api/subsidy/:order_id/settle` — marks any merchant's ledger as settled
3. `POST /api/subsidy/:order_id/paid` — marks any merchant's ledger as paid

### Fix
Add `merchant_id` verification to the `SubsidySettlementEngine` methods:
- `captureIMEI()` — find ledger entry with `{ order_id, merchant_id }`, not just `{ order_id }`
- `markSettled()` — same filter
- `markPaid()` — same filter
- Update `settlement-routes.ts` to pass `request.merchantId` to each engine method

### Files to modify
- `src/modules/checkout/services/subsidy-settlement-engine.ts` — add `merchantId` parameter to `captureIMEI`, `markSettled`, `markPaid`
- `src/modules/checkout/routes/settlement-routes.ts` — pass `request.merchantId` to engine methods

---

## Part 2: Dashboard Pages

### 2.1 Orders Page (`/orders` + `/orders/:id`)

**Purpose:** Merchants view all orders with full details (cart, customer, payment, offers, EMI).

**Data source:** `GET /api/orders` (paginated) + `GET /api/orders/:id` (detail)

**List page (`/orders`):**
- Paginated order list table: Order ID, Merchant Order ID, PG, Amount, Status, Payment Method, Date
- Filter by status (paid, failed, refunded, created) and date range
- "Create Payment Link" button → opens modal to create checkout session
  - Toggle: "Freeform" (default) or "From Catalog"
  - Freeform: product name, amount, quantity → `POST /api/checkout/sessions`
  - From Catalog: select existing SKU from product database → auto-fills name + price
  - Returns `checkout_url` — merchant copies to share with customer
  - Optional: merchant_order_id field

**Detail page (`/orders/:id`) — separate bookmarkable page:**
- Full cart items with prices, quantities, categories
- Customer info (name, email, phone, address)
- Applied offers with discount amounts
- Payment details (PG name, PG order ID, PG payment ID, payment method)
- EMI details (if applicable: bank, tenure, EMI amount, interest, subsidy)
- Refund button (if order status is `paid`) → opens refund modal
  - Full refund (default) or partial (enter amount)
  - Reason (required, textarea)
  - On full refund: calls `POST /api/orders/:id/refund`
    - If order has brand subsidy (IMEI blocked): also calls OEM adapter to unblock IMEI
    - Subsidy ledger entry marked as `disputed` with refund reference
  - On partial refund: same but order status stays `paid`

**Nav:** Add "Orders" to Overview nav group

### 2.2 Refund Management (in Orders detail page)

**Purpose:** Merchants refund orders from the dashboard.

**Data source:** `POST /api/orders/:id/refund`

**Refund + IMEI unblock + subsidy reversal flow:**
When a merchant refunds an order that had brand subsidy:
1. Fuse processes the refund via PG adapter (`refundPayment`)
2. If order has a subsidy ledger entry with IMEI blocked (`imei_blocked === true`):
   - This only applies if the campaign had `requires_imei === true`
   - Fuse calls OEM adapter to unblock IMEI (`OEMService.unblockIMEI`)
   - Subsidy ledger entry status → `disputed` (brand settlement reversed)
   - Refund ID + IMEI unblock reference stored in ledger
3. If campaign did NOT require IMEI (`requires_imei === false`):
   - No IMEI unblock needed
   - Subsidy ledger entry status → `disputed` with refund reference
4. Transaction log records the refund (payment_method: `refund`)
5. Order status → `refunded` (full) or stays `paid` (partial)

**UI Features:**
- Refund button visible only when `order_status === 'paid'`
- Click → opens refund modal:
  - Full refund (default) or partial (enter amount)
  - Reason (required, textarea)
  - If order has brand subsidy: warning shown "This will unblock IMEI and reverse brand subsidy"
  - Confirm button
- On success: shows refund ID + IMEI unblock status, updates order status

### 2.3 Subsidy Ledger Page (`/subsidy`)

**Purpose:** Merchants see "Samsung owes you ₹45,000 across 9 orders."

**Data source:** `GET /api/subsidy/reconciliation` + `GET /api/subsidy/ledger`

**Features:**
- Reconciliation cards at top: total pending, total amount, by-brand breakdown
- Brand cards: "Samsung — ₹45,000 pending across 9 entries" with status breakdown (pending, imei_blocked, settled, paid, disputed)
- Ledger table: Order ID, Brand, Campaign, Amount, EMI Type, IMEI, IMEI Blocked, Settlement Status, Date
- Filter by settlement status
- "Capture IMEI" button only visible for entries where `requires_imei === true` AND status = pending
  - If campaign doesn't require IMEI (`requires_imei === false`), no IMEI capture UI shown
  - Opens modal with IMEI input (15-digit, auto-validate with Luhn)
  - Calls `POST /api/subsidy/:order_id/imei`
  - IMEI blocking goes through OEM adapter only (no manual override)
  - Shows success + OEM reference ID + unblock date
- "Mark Settled" button for entries with imei_blocked status
  - Opens modal with settlement reference input
  - Calls `POST /api/subsidy/:order_id/settle`
- Disputed entries (from refunds) shown with red indicator + refund reference

**Nav:** Add "Subsidy Ledger" to Overview nav group

### 2.4 EMI Campaigns Page (`/emi-campaigns`)

**Purpose:** Merchants create and manage EMI campaigns (no-cost/low-cost offers on specific cards).

**Data source:** `GET /api/admin/emi-campaigns`, `POST /api/admin/emi-campaigns`, `PATCH /api/admin/emi-campaigns/:id`

**Features:**
- Campaign list table: Code, Title, Scope (merchant/brand), Bank, EMI Type, Status, Start/End Date
- "Create Campaign" button → form modal:
  - Code, Title, Scope (merchant/brand dropdown)
  - Bank (text input), IIN prefixes (comma-separated, 6-digit each)
  - Card tiers (multi-select: platinum, signature, infinite, etc.)
  - EMI type (no_cost/low_cost)
  - Products (optional, comma-separated SKU IDs or null for all)
  - Max total, max per merchant (brand only), max per card
  - Requires IMEI (checkbox, for brand campaigns)
  - Start/end date pickers
- Active/inactive toggle on each campaign
- IIN ranges management section below campaigns:
  - Table: Prefix, Bank, Card Type, Tier, Network, Status
  - "Add IIN" button → form modal

**Nav:** Add "EMI Campaigns" to Offers nav group

### 2.5 Sessions Page (`/sessions`)

**Purpose:** Merchants view active/expired checkout sessions and retry failed ones.

**Data source:** New API `GET /api/checkout/sessions` (merchant-scoped, paginated)

**Features:**
- Session list table: Session ID, Cart Amount, Items Count, Payment Status, Created, Expires
- Filter by status (pending, processing, success, failed, expired)
- "Retry" button for failed/expired sessions → calls `POST /api/checkout/sessions/:id/retry`
  - Shows new checkout URL
- "Expire" button for pending sessions → calls `POST /api/checkout/sessions/:id/expire`
- "View" link opens checkout page in new tab

**Nav:** Add "Sessions" to Overview nav group

### 2.6 API Addition: `GET /api/checkout/sessions` (merchant list)

New endpoint needed since existing session endpoints are:
- `POST /api/checkout/sessions` (create — auth required)
- `GET /api/checkout/sessions/:id` (get single — auth required)

Missing: `GET /api/checkout/sessions` (list all for merchant — auth required)

Add to `checkout-routes.ts`:
- Paginated (page, limit)
- Filter by payment_status
- Scoped by `request.merchantId`
- Returns: session_id, cart amount, item count, payment_status, created_at, expires_at

### 2.7 API Update: Refund route — IMEI unblock + subsidy reversal

Update `src/modules/checkout/routes/refund-routes.ts` to:
1. After PG refund succeeds, check if order has a subsidy ledger entry
2. If entry has IMEI blocked, call `OEMService.unblockIMEI(brand, imei)`
3. Mark subsidy ledger as `disputed` with refund reference
4. Store IMEI unblock reference in ledger
5. Return IMEI unblock status in refund response

The refund route needs access to `OEMService` — inject via `server.oemService` decorator (already set at composition root).

---

## Part 3: Navigation Updates

Current nav groups:
```
Overview: Dashboard, Analytics, Transactions
Offers: Create Offer, Stacking Policy
Catalog: Products, Combos
Settings: API Keys, Payment Gateway
```

Updated nav groups:
```
Overview: Dashboard, Analytics, Transactions, Orders, Sessions
Offers: Create Offer, Stacking Policy, EMI Campaigns
Catalog: Products, Combos
Settings: API Keys, Payment Gateway
Subsidy Ledger (new group): Subsidy Ledger
```

---

## Part 4: Checkout Session URL Security

### Issue
Current session IDs: `sess_${timestamp}_${random8}` — guessable pattern (timestamp + 8 random alphanumeric chars).

### Fix
Use `crypto.randomUUID()` for session IDs instead of timestamp + random:
- `sess_a3f8b2c1-9d4e-4f7b-8a2c-1e5d6f7a8b9c`
- Cryptographically unguessable
- Modify `mongo-session-repository.ts` create method

---

## Implementation Priority

| # | Task | Priority | Dependencies |
|---|---|---|---|
| 1 | Fix tenant isolation in settlement engine (3 endpoints) | Critical | None |
| 2 | Add `GET /api/checkout/sessions` list endpoint | High | None |
| 3 | Use crypto.randomUUID for session IDs | High | None |
| 4 | Update refund route: IMEI unblock + subsidy reversal on refund | High | OEM adapter (done) |
| 5 | Dashboard: Orders list page + Create Payment Link modal | High | #2 |
| 6 | Dashboard: Orders detail page (/orders/:id) with refund | High | #4 |
| 7 | Dashboard: Subsidy ledger page with IMEI capture | High | #1 |
| 8 | Dashboard: EMI campaigns page | Medium | None |
| 9 | Dashboard: Sessions page | Medium | #2 |
| 10 | Update navigation in dashboard layout | Medium | #5-9 |
| 11 | Update OpenAPI spec with new endpoints | Low | All |
| 12 | Update ROADMAP.md with completed items | Low | All |

---

## Files Summary

### Backend modifications
- `src/modules/checkout/services/subsidy-settlement-engine.ts` — add merchantId param to captureIMEI, markSettled, markPaid
- `src/modules/checkout/routes/settlement-routes.ts` — pass merchantId to engine methods
- `src/modules/checkout/routes/checkout-routes.ts` — add GET sessions list endpoint
- `src/modules/checkout/routes/refund-routes.ts` — add IMEI unblock + subsidy reversal on full refund
- `src/modules/checkout/repositories/mongo-session-repository.ts` — crypto.randomUUID for session IDs

### Frontend new pages
- `dashboard/app/(dashboard)/orders/page.tsx` — orders list + create payment link modal
- `dashboard/app/(dashboard)/orders/[id]/page.tsx` — order detail + refund modal
- `dashboard/app/(dashboard)/sessions/page.tsx` — sessions list + retry/expire
- `dashboard/app/(dashboard)/emi-campaigns/page.tsx` — EMI campaigns + IIN ranges management
- `dashboard/app/(dashboard)/subsidy/page.tsx` — subsidy ledger + IMEI capture + settlement
- `dashboard/app/(dashboard)/layout.tsx` — update navigation (add Orders, Sessions, EMI Campaigns, Subsidy Ledger)

### Docs
- `docs/mintlify/openapi.yaml` — add GET /api/checkout/sessions endpoint + refund endpoint
- `docs/ROADMAP.md` — mark completed items
