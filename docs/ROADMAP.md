# OfferForge — Product Roadmap & Progress Tracker

> **Last updated:** 2026-07-30
> **Status:** Phase 1 complete, Phase 2 in progress

This document is the single source of truth for what's built, what's in progress, and what's planned. **Update this file whenever a feature is completed, started, or scoped.**

---

## Phase 1 — Checkout & Offers (✅ Complete)

### Offers Engine
- [x] 13 rule types (min cart, max cart, customer segment, first-time buyer, per-customer limit, total usage limit, category restriction, product restriction, brand restriction, product combo, time window, weekend only, date range)
- [x] Coupon codes (flat + percentage with max cap)
- [x] Auto-applied offers (cart-data-driven)
- [x] Stacking & conflict resolution (priority, exclusive flags, global policy, per-offer overrides, discount cap)
- [x] Offer CRUD API + validation + apply endpoints
- [x] Product catalog (CRUD + bulk upsert + combos)
- [x] Analytics (overview + per-offer + conversion tracking)

### Hosted Checkout
- [x] Checkout session lifecycle (create → cart → customer → select-payment → process-payment → redirect)
- [x] Hosted checkout page (Next.js, single-page with bottom-sheet modals, Poppins font, navy/gold fintech theme)
- [x] 4 sections: Order Summary, Coupons & Offers, Delivery Details, Payment Methods
- [x] EMI calculation engine (standard, no-cost, low-cost using reducing balance formula)
- [x] Bank rate management (admin CRUD)
- [x] BIN → bank lookup
- [x] Payment gateway adapter interface (MockPGAdapter for dev)
- [x] Order creation + retrieval API

### EMI Campaign Engine
- [x] IIN database (25+ premium Indian card IINs with bank + tier + network)
- [x] EMI campaign schema (merchant-scoped + brand-scoped with cross-merchant velocity)
- [x] Campaign eligibility engine (IIN match, tier match, product match, scope, velocity caps, date window)
- [x] Campaign admin CRUD API
- [x] IIN range admin CRUD API
- [x] Subsidy ledger schema (for brand settlement tracking)
- [x] Wired into select-payment endpoint (returns no-cost/low-cost EMI when campaign matches)
- [x] Seed script for IINs + sample campaigns

### Auth & Team
- [x] JWT auth (signup, login, me endpoints)
- [x] API key management (scoped, create/revoke)
- [x] Team invites (6-char code, email-bound, 7-day expiry, role hierarchy)
- [x] Role-based access control (owner, admin, offer_manager, analytics_viewer)
- [x] Dual auth middleware (JWT + API key coexist)

### Frontend Surfaces
- [x] Marketing website (Stripe-inspired, responsive, all sections)
- [x] Dashboard (Next.js, 7 pages: dashboard, analytics, create offer, stacking policy, products, combos, login)
- [x] Playground (real store experience: product grid → PDP → cart → checkout redirect)
- [x] Hosted checkout (single-page fintech UI with bottom-sheet modals)

### Documentation
- [x] Mintlify docs (7 guides: introduction, quickstart, authentication, checkout, offers, stacking, products)
- [x] OpenAPI spec with 27 endpoints + Try It buttons
- [x] API reference auto-generated from OpenAPI

### Infrastructure
- [x] Docker MongoDB with auth
- [x] mongodb-memory-server for tests
- [x] Seed scripts (demo data + IIN ranges + campaigns)
- [x] dev.sh / stop.sh for local development
- [x] 294 tests passing

---

## Phase 2 — Bank & Brand Offers (🔄 In Progress)

### Payment Gateway Integration
- [ ] Razorpay adapter (replaces MockPGAdapter with real payment processing)
- [ ] Razorpay webhook handling (payment.authenticated → order.created)
- [ ] Card tokenization (PG returns token_id + card metadata, no PAN on our servers)
- [ ] 3D Secure 2.0 support (RBI mandate for cards > ₹5,000, handled by PG)

### Bank Offers
- [ ] `BankOfferEvaluator` in OfferEvaluatorRegistry (new evaluator, no changes to existing)
- [ ] `payment_method_restriction` rule type (checks payment method + bank)
- [ ] Card BIN → bank offer matching at checkout ("Use HDFC CC → 10% off")
- [ ] Checkout page: bank offers shown when card is entered

### Brand Subsidy Engine
- [ ] IMEI capture at checkout (customer enters IMEI on checkout page)
- [ ] IMEI format validation
- [ ] OEM API integration — Samsung (block IMEI via Samsung API)
- [ ] OEM API integration — Apple (block IMEI via Apple API)
- [ ] OEM API integration — OnePlus (block IMEI via OnePlus API)
- [ ] Subsidy settlement engine (tracks "brand owes merchant ₹X" across orders)
- [ ] Settlement reconciliation reports (monthly CSV for brand finance teams)
- [ ] Merchant dashboard: subsidy ledger view ("Samsung owes you ₹45,000 across 9 orders")
- [ ] Brand dashboard: campaign performance + IMEI block status

### Dashboard Enhancements
- [ ] Orders list page (paginated, filterable by status/date)
- [ ] Checkout funnel analytics (session → cart → details → payment → success)
- [ ] EMI campaign management UI (create/edit campaigns in dashboard)
- [ ] IIN range management UI (add/edit IIN ranges in dashboard)

### Checkout Enhancements
- [ ] Embeddable checkout widget (slide-over/inline instead of full-page redirect)
- [ ] Checkout A/B testing (test different layouts, offer placements)
- [ ] Saved cards (via PG token vault, PCI SAQ-A compliant)
- [ ] Multi-language checkout (Hindi, Tamil, Telugu — India-first)

---

## Phase 3 — Scale & Ecosystem (📋 Planned)

### Platform Integrations
- [ ] Shopify app (one-click install for Shopify merchants)
- [ ] WooCommerce plugin
- [ ] Magento extension
- [ ] Custom API SDKs (Python, PHP, Java)

### Advanced EMI
- [ ] Cardless EMI partner APIs (ZestMoney, Simpl, LazyPay)
- [ ] EMI widget for product pages (show EMI options before checkout)
- [ ] Coupon + EMI conflict resolution (can a coupon stack with no-cost EMI?)
- [ ] EMI eligibility pre-check (show "EMI available" on product page)

### Intelligence
- [ ] Personalization engine (recommend offers based on customer history)
- [ ] Price drop alerts (notify customers when product hits their target price)
- [ ] Abandoned cart recovery (email/SMS with personalized offers)
- [ ] Offer performance ML (predict which offers will convert best)

### Scale
- [ ] Multi-currency checkout (USD, AED, SGD for cross-border)
- [ ] Subscription checkout flows (recurring billing with offers)
- [ ] B2B checkout (bulk pricing, PO-based checkout, net terms)

---

## Regulatory & Compliance (📋 Planned)

- [ ] RBI Payment Aggregator license (₹15Cr net worth, 12-18 month process)
- [ ] VISA BASS direct access (requires PA license + bank sponsorship)
- [ ] PCI-DSS SAQ-A certification (once PG tokenization is implemented)
- [ ] Data localization compliance (all data stored in India)
- [ ] GST compliance for offers (discount tax implications)

---

## Deployment & Infrastructure (📋 Planned)

- [ ] MongoDB Atlas (production database)
- [ ] API deployment (Railway or Render)
- [ ] Dashboard + Checkout deployment (Vercel)
- [ ] Mintlify hosted docs (docs.offerforge.io)
- [ ] CI/CD pipeline (GitHub Actions: test → build → deploy)
- [ ] Pre-commit hooks (Husky + lint-staged)
- [ ] Production monitoring (Last9 or similar)
- [ ] Error tracking (Sentry)
- [ ] CDN for static assets
- [ ] Custom domain (offerforge.io)

---

## Architecture Decisions

| Decision | Date | Status |
|---|---|---|
| Modular monolith with interface-only communication | 2026-07-18 | Active |
| Zod for all validation (no JSON schema) | 2026-07-18 | Active |
| TDD mandatory for all logic | 2026-07-18 | Active |
| No hardcoded brand name (config.brandName) | 2026-07-18 | Active |
| No Co-authored-by trailers in commits | 2026-07-18 | Active |
| Hosted checkout (full-page redirect) as v1 | 2026-07-20 | Active |
| EMI engine owned by OfferForge (not PG) | 2026-07-20 | Active |
| IIN database for card tier lookup (no VISA BASS access) | 2026-07-21 | Active |
| Brand campaigns with cross-merchant velocity + IMEI blocking | 2026-07-21 | Active |
| Subsidy ledger as revenue model (1-2% of settled brand subsidy) | 2026-07-21 | Active |

---

## Key Specs & Plans

| Document | Description |
|---|---|
| `docs/superpowers/specs/2026-07-18-coupons-module-design.md` | Original PRD for offers engine |
| `docs/superpowers/specs/2026-07-20-checkout-provider-design.md` | Checkout provider design spec |
| `docs/superpowers/plans/2026-07-18-core-engine.md` | Core engine implementation plan |
| `docs/superpowers/plans/2026-07-18-api-layer.md` | API layer implementation plan |
| `docs/superpowers/plans/2026-07-19-auth-team-module.md` | Auth module implementation plan |
| `docs/superpowers/plans/2026-07-20-checkout-foundation.md` | Checkout foundation implementation plan |
| `docs/superpowers/plans/2026-07-21-emi-campaign-engine.md` | EMI campaign engine implementation plan |
