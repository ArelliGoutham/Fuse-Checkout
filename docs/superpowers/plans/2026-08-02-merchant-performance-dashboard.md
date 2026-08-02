# Merchant Performance Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the offers-first Dashboard home with a merchant-scoped checkout business-performance overview while preserving the existing dashboard visual system.

**Architecture:** A new backend dashboard module exposes one authenticated `GET /api/dashboard/overview` endpoint. It aggregates existing MongoDB collections in parallel and returns a stable overview contract. The existing Next.js Dashboard route consumes that contract and presents performance first, operational attention second, and offers/subsidy impact third.

**Tech Stack:** TypeScript, Fastify 5, MongoDB, Jest with mongodb-memory-server, Next.js 16, React 19, Tailwind CSS 4.

## Global Constraints

- Keep all results strictly filtered to `request.merchantId`.
- Default to a 30-day UTC period; accept only `7d`, `30d`, and `90d`.
- Define GMV as the sum of paid `orders.final_amount`, never transaction attempts.
- Define payment-attempt success rate from `transaction_logs` records with `success` or `failed` status only.
- Define checkout conversion as paid orders divided by sessions created in the selected period.
- Show offer discounts granted, not offer-assisted revenue, because conversion tracking does not persist attributable order value.
- Preserve the current dark dashboard layout, tokens, and navigation shell.
- Do not expose gateway credentials, card data, or raw payment gateway responses.

---

### Task 1: Dashboard Overview Route Contract

**Files:**
- Create: `src/modules/dashboard/routes/dashboard-routes.test.ts`
- Create: `src/modules/dashboard/routes/dashboard-routes.ts`
- Modify: `src/server.ts`

**Interfaces:**
- Produces: `GET /api/dashboard/overview?period=7d|30d|90d`.
- Consumes: `orders`, `checkout_sessions`, `transaction_logs`, `pg_alerts`, `offers`, `redemptions`, and `subsidy_ledger` collections.

- [ ] **Step 1: Write the failing route tests**

Create Fastify integration tests with two merchants. Seed merchant one with paid and failed payment data inside the 7-day period, seed merchant two with larger values, then assert merchant one receives only:

```ts
expect(body.performance).toMatchObject({
  gross_payment_volume: 1500,
  paid_orders: 2,
  average_order_value: 750,
  checkout_sessions: 4,
  session_to_paid_conversion_rate: 50,
  payment_attempt_success_rate: 66.67,
});
expect(body.offers).toMatchObject({
  active_offers: 1,
  redemptions: 2,
  paid_redemptions: 1,
  discounts_granted: 100,
});
```

Also assert `period=invalid` returns `400` and a merchant with no records receives every top-level section with zero/default values.

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- dashboard-routes.test.ts`

Expected: FAIL because `GET /api/dashboard/overview` is not registered.

- [ ] **Step 3: Implement the route**

Create the route module and register it in `src/server.ts`. Validate the period with Zod, derive UTC `from` and `to`, and run the merchant-filtered aggregations in parallel. Return the documented `period`, `performance`, `funnel`, `gateways`, `attention`, `offers`, `finance`, and `recent_activity` fields with zero-value defaults.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- dashboard-routes.test.ts`

Expected: PASS.

### Task 2: Merchant Performance Dashboard UI

**Files:**
- Modify: `dashboard/app/(dashboard)/page.tsx`

**Interfaces:**
- Consumes: `GET /api/dashboard/overview?period=<preset>` response from Task 1.
- Produces: a dashboard page that links to existing `/transactions`, `/orders`, `/sessions`, `/pg-health`, `/subsidy`, `/analytics`, and `/create` routes.

- [ ] **Step 1: Add the dashboard overview types and loader**

Replace the offers and legacy analytics fetches with one overview fetch. Keep loading and API error handling. Request the selected `7d`, `30d`, or `90d` period.

- [ ] **Step 2: Render business performance before offers**

Render: period selector; GMV, paid orders, checkout conversion, payment success rate; checkout funnel; gateway health and attention queue; recent payment activity; compact offer impact and subsidy exposure. Every attention item must deep-link to the matching existing detailed route.

- [ ] **Step 3: Preserve the established dashboard design**

Use existing `bg-surface`, `border-border`, status colors, Font Awesome icons, card shapes, and dark layout. Do not change global CSS, the app layout, or navigation in this task.

- [ ] **Step 4: Verify the frontend contract**

Run: `npm run build` from `dashboard/`.

Expected: Next.js compiles the page without type or build errors.

### Task 3: Full Verification

**Files:**
- Test: `src/modules/dashboard/routes/dashboard-routes.test.ts`

- [ ] **Step 1: Run backend tests**

Run: `npm test -- dashboard-routes.test.ts`

Expected: PASS with merchant isolation, validation, and empty-data coverage.

- [ ] **Step 2: Run project type checks**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 3: Run dashboard build**

Run: `npm run build` from `dashboard/`.

Expected: PASS, or report environmental dependency failures separately from source errors.

- [ ] **Step 4: Inspect the final diff**

Run: `git diff --check` and `git diff --stat`.

Expected: no whitespace errors; only dashboard overview backend, tests, registration, and Dashboard-tab UI changes.
