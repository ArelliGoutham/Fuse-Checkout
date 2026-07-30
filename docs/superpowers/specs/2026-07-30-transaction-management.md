# Transaction Management & Multi-PG Routing — Design Spec

> **Date:** 2026-07-30
> **Phase:** Phase 2
> **Status:** Draft
> **Depends on:** Checkout provider (Phase 1), EMI campaign engine (Phase 2.1)

---

## 1. Order ID Structure

### Requirements
- Incremental (sortable by creation time)
- Human-readable (sharable in support calls, emails)
- Indexable (works in both MongoDB and future SQL databases)
- Partitionable (can shard by date prefix)
- No sequential integers exposed (prevents order count enumeration)

### Format: `OF-YYMMDD-NNNNNN`

```
OF-260730-000123
│  │      │
│  │      └── 6-digit daily sequence (resets each day, zero-padded)
│  └── YYMMDD date (partition + sort + human readable)
└── Platform prefix (configurable, "OF" = OfferForge)
```

**Properties:**
- **Sortable:** Lexicographic sort = chronological sort (YYMMDD prefix)
- **Partitionable:** First 8 chars after prefix = date shard key (`260730`)
- **Human-readable:** "Hey, my order OF-260730-000123 is delayed" — readable on phone
- **No enumeration:** Sequence resets daily, max 999,999 per day — can't guess total order volume
- **SQL-ready:** `VARCHAR(16)` with index on full string or composite index on (date_part, seq_part)
- **Configurable prefix:** `config.orderPrefix` from env var `ORDER_ID_PREFIX` (default "OF")

### Implementation

```typescript
// src/modules/checkout/services/order-id-generator.ts

/**
 * Generates incremental, human-readable, partitionable order IDs.
 * Format: OF-YYMMDD-NNNNNN
 * Uses MongoDB counter collection for daily sequence.
 */
export class OrderIdGenerator {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  async generateId(): Promise<string> {
    const now = new Date();
    const datePart = formatDate(now); // "260730"
    const prefix = process.env.ORDER_ID_PREFIX || 'OF';

    // Atomically increment daily counter
    const counter = await this.db.collection('order_counters').findOneAndUpdate(
      { _id: `order_${datePart}` },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: 'after' }
    );

    const seq = counter?.seq || 1;
    const seqPart = String(seq).padStart(6, '0');

    return `${prefix}-${datePart}-${seqPart}`;
  }
}

function formatDate(d: Date): string {
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}
```

### Counter collection
```typescript
// MongoDB collection: order_counters
{
  _id: "order_260730",   // date-partitioned key
  seq: 123,               // incremented atomically
  date: "2026-07-30"      // for querying/cleanup
}
```

### Migration from current IDs
- Current orders use `"order_..."` or ObjectId strings
- New orders use `OF-YYMMDD-NNNNNN` format
- Existing orders keep their old `_id` (backward compatible)
- `GET /api/orders/:id` accepts both formats

---

## 2. Session Lifecycle

### States

```
                    ┌─────────┐
                    │ pending │ ← created, customer redirects
                    └────┬────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
              ▼          ▼          ▼
        ┌─────────┐ ┌─────────┐ ┌──────────┐
        │processing│ │ expired │ │  success │
        └────┬────┘ └─────────┘ └──────────┘
             │
        ┌────┴────┐
        │         │
        ▼         ▼
   ┌────────┐ ┌────────┐
   │ failed │ │ success│
   └────────┘ └────────┘
```

| State | When | Can edit cart? | Can retry? |
|---|---|---|---|
| `pending` | Session created, customer hasn't paid | Yes (merchant PATCH) | N/A |
| `processing` | Payment initiated, waiting PG response | No | No |
| `success` | Payment captured by PG | No (locked) | No |
| `failed` | Payment declined or errored | No | Yes (creates new session) |
| `expired` | Past `expires_at` (24h) | No | Yes (creates new session) |

### New endpoints

**`PATCH /api/checkout/sessions/:id`** — Update session cart (merchant only, pending state only)
```json
Request: {
  "cart": { "amount": 9999, "items": [{ "sku_id": "SKU-1", "name": "Phone", "price": 9999, "qty": 1 }] }
}
Response: 200 { "session_id": "sess_abc", "status": "pending", "cart": {...} }
Error: 409 if session is not pending
```

**`POST /api/checkout/sessions/:id/retry`** — Clone session for failed/expired retry
```json
Response: 201 {
  "session_id": "sess_new123",
  "checkout_url": "https://checkout.offerforge.io/sess_new123",
  "original_session_id": "sess_abc"
}
```
- Copies cart + customer_info from original session
- Creates fresh session with new `expires_at`
- Links `original_session_id` for audit trail
- Original session remains in `failed`/`expired` state

**`POST /api/checkout/sessions/:id/expire`** — Manually expire a session (merchant only)
- For merchants who want to close abandoned sessions immediately

### Session audit log
Every state change is logged:
```typescript
// Collection: session_audit_logs
{
  _id: string,
  session_id: string,
  merchant_id: string,
  action: "created" | "cart_updated" | "customer_saved" | "payment_initiated" |
          "payment_success" | "payment_failed" | "expired" | "retried",
  previous_state: string,
  new_state: string,
  changed_by: "merchant" | "customer" | "system",
  metadata: object,        // cart diff, payment details, etc.
  timestamp: Date
}
```

---

## 3. Order Correlation (Merchant ↔ OfferForge ↔ PG)

### Updated session creation

`merchant_order_id` is **optional** in `CreateSessionSchema`:
```typescript
export const CreateSessionSchema = z.object({
  cart: z.object({ ... }),
  redirect_urls: z.object({ ... }),
  customer: z.object({ ... }).optional(),
  merchant_order_id: z.string().optional(),  // ← NEW: merchant's own order ref
});
```

If merchant passes `merchant_order_id`, it flows through to the order. If not, OfferForge's generated order ID (`OF-YYMMDD-NNNNNN`) is the only order ID.

### Updated order schema

```typescript
export const OrderSchema = z.object({
  _id: z.string(),                        // OF-260730-000123 (OfferForge generated)
  merchant_id: z.string(),
  session_id: z.string(),
  merchant_order_id: z.string().nullable(), // ← NEW: merchant's own ID (null if not provided)

  // Cart + payment
  cart_amount: z.number(),
  total_discount: z.number(),
  final_amount: z.number(),
  customer_info: z.object({ ... }),
  applied_offers: z.array({ ... }),
  payment_method: z.string(),

  // PG correlation
  pg_name: z.string(),                     // ← which PG was used
  pg_order_id: z.string().nullable(),      // ← PG's order ID
  pg_payment_id: z.string().nullable(),    // ← PG's payment ID
  pg_raw_response: z.record(z.unknown()).nullable(), // ← full PG response for audit

  order_status: z.enum(['created', 'paid', 'failed', 'refunded']),
  emi_details: z.object({ ... }).nullable(),

  // Audit
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
```

### Lookup by merchant's order ID
```
GET /api/orders?merchant_order_id=ORD-12345
→ Returns order with all PG correlation
```

### Three-way ID mapping table

| Field | Who sets it | When | Example |
|---|---|---|---|
| `merchant_order_id` | Merchant | At session creation | `ORD-12345` |
| `_id` (order ID) | OfferForge | At order creation | `OF-260730-000123` |
| `session_id` | OfferForge | At session creation | `sess_abc123` |
| `pg_order_id` | PG | At PG order creation | `order_NK8x2` |
| `pg_payment_id` | PG | At payment capture | `pay_NK8x3` |

---

## 4. Transaction Log

Every payment attempt (including failures and fallbacks) is logged:

```typescript
// src/modules/checkout/schemas/transaction-log.ts
export const TransactionLogSchema = z.object({
  _id: z.string(),
  order_id: z.string(),              // OfferForge order ID
  session_id: z.string(),
  merchant_id: string,
  merchant_order_id: z.string().nullable(),

  // PG details
  attempt_number: z.number().int(),  // 1 for primary, 2 for first fallback, etc.
  pg_name: z.string(),               // "razorpay", "cashfree"
  pg_order_id: z.string().nullable(),
  pg_payment_id: z.string().nullable(),
  pg_status: z.string(),             // "captured", "failed", "pending"
  pg_error_code: z.string().nullable(),
  pg_error_message: z.string().nullable(),
  pg_raw_request: z.record(z.unknown()),  // what we sent (no PAN)
  pg_raw_response: z.record(z.unknown()), // full PG response

  // Payment details
  amount: z.number(),
  payment_method: z.string(),
  payment_status: z.enum(['success', 'failed', 'pending']),

  // Routing
  routing_reason: z.string(),        // "razorpay has 96.2% > cashfree 94.1%"
  is_fallback: z.boolean(),          // true if this was a retry on another PG

  // Timing
  initiated_at: z.string().datetime(),
  completed_at: z.string().datetime().nullable(),
  latency_ms: z.number().nullable(),

  created_at: z.string().datetime(),
});

export type TransactionLog = z.infer<typeof TransactionLogSchema>;
```

---

## 5. PG Stats Aggregation

```typescript
// src/modules/checkout/schemas/pg-stats.ts
export const PGStatsSchema = z.object({
  _id: z.string(),                   // "razorpay_merch_demo_2026-07-30"
  pg_name: z.string(),
  merchant_id: z.string(),
  date: z.string(),                  // "2026-07-30"

  total_attempts: z.number().int(),
  successful: z.number().int(),
  failed: z.number().int(),
  pending: z.number().int(),

  success_rate: z.number(),          // calculated: successful / total_attempts * 100
  avg_latency_ms: z.number(),
  p95_latency_ms: z.number(),

  total_volume: z.number(),          // ₹ amount successful
  avg_order_value: z.number(),

  failures_by_reason: z.record(z.number()), // { "network_timeout": 12, "card_declined": 15, ... }

  updated_at: z.string().datetime(),
});

export type PGStats = z.infer<typeof PGStatsSchema>;
```

### Aggregation job
Runs hourly (or on each transaction completion) to update daily stats:
```typescript
async function aggregatePGStats(pgName: string, merchantId: string, date: string) {
  const logs = await db.collection('transaction_logs').find({
    pg_name: pgName,
    merchant_id: merchantId,
    initiated_at: { $gte: startOfDay, $lt: endOfDay }
  }).toArray();

  const total = logs.length;
  const successful = logs.filter(l => l.payment_status === 'success').length;
  const failed = logs.filter(l => l.payment_status === 'failed').length;
  const latencies = logs.filter(l => l.latency_ms).map(l => l.latency_ms!);
  const failures = logs.filter(l => l.pg_error_code).reduce((acc, l) => {
    acc[l.pg_error_code!] = (acc[l.pg_error_code!] || 0) + 1;
    return acc;
  }, {});

  await db.collection('pg_stats').updateOne(
    { _id: `${pgName}_${merchantId}_${date}` },
    { $set: {
      pg_name: pgName, merchant_id: merchantId, date,
      total_attempts: total, successful, failed,
      pending: total - successful - failed,
      success_rate: total > 0 ? (successful / total) * 100 : 0,
      avg_latency_ms: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
      p95_latency_ms: percentile(latencies, 95),
      total_volume: logs.filter(l => l.payment_status === 'success').reduce((sum, l) => sum + l.amount, 0),
      avg_order_value: successful > 0 ? totalVolume / successful : 0,
      failures_by_reason: failures,
      updated_at: new Date().toISOString(),
    }},
    { upsert: true }
  );
}
```

---

## 6. Smart Router

### PGAdapter interface extension

```typescript
// src/modules/pg-adapters/types.ts (modify existing)
export interface PGAdapter {
  processPayment(params: PaymentParams): Promise<PaymentResult>;
  getName(): string;                    // ← NEW
  getHealth(): Promise<PGHealth>;       // ← NEW
}

export interface PGHealth {
  healthy: boolean;
  success_rate: number;                 // last 1 hour
  avg_latency_ms: number;
  last_error: string | null;
}
```

### Smart router service

```typescript
// src/modules/checkout/services/smart-router.ts
export class SmartRouter {
  private adapters: PGAdapter[];
  private db: Db;

  constructor(adapters: PGAdapter[], db: Db) {
    this.adapters = adapters;
    this.db = db;
  }

  async route(merchantId: string, amount: number): Promise<RoutingDecision> {
    // Fetch last 7 days stats per PG for this merchant
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const stats = await this.db.collection('pg_stats').find({
      merchant_id: merchantId,
      date: { $gte: sevenDaysAgo.toISOString().slice(0, 10) }
    }).toArray();

    // Calculate rolling success rate per PG
    const pgRates: Record<string, { total: number; success: number }> = {};
    for (const s of stats) {
      if (!pgRates[s.pg_name]) pgRates[s.pg_name] = { total: 0, success: 0 };
      pgRates[s.pg_name].total += s.total_attempts;
      pgRates[s.pg_name].success += s.successful;
    }

    // Sort by success rate (descending), fallback to adapter order
    const ranked = this.adapters
      .map(a => {
        const r = pgRates[a.getName()];
        const rate = r && r.total > 0 ? (r.success / r.total) * 100 : 100; // new PGs start at 100%
        return { adapter: a, rate, hasData: r && r.total > 0 };
      })
      .sort((a, b) => b.rate - a.rate);

    return {
      primary: ranked[0].adapter,
      fallback: ranked.slice(1),
      reason: `${ranked[0].adapter.getName()} has ${ranked[0].rate.toFixed(1)}% success rate`,
    };
  }
}

export interface RoutingDecision {
  primary: PGAdapter;
  fallback: PGAdapter[];
  reason: string;
}
```

### Payment flow with smart routing + fallback

```typescript
async function processPaymentWithFallback(
  session: CheckoutSession,
  method: string,
  router: SmartRouter
): Promise<PaymentResult> {
  const decision = await router.route(session.merchant_id, session.cart.amount);
  let attempt = 1;

  for (const adapter of [decision.primary, ...decision.fallback]) {
    try {
      const result = await adapter.processPayment({ amount, method });

      // Log every attempt (success or failure)
      await logTransaction({
        order_id, session_id, merchant_id,
        attempt_number: attempt,
        pg_name: adapter.getName(),
        payment_status: result.status,
        routing_reason: decision.reason,
        is_fallback: attempt > 1,
        latency_ms: result.latency_ms,
        pg_raw_response: result.raw_response,
        ...
      });

      if (result.status === 'success') return result;
      attempt++;
    } catch (error) {
      // Log failure, continue to next PG
      await logTransaction({ ..., pg_error_code: error.code, ... });
      attempt++;
    }
  }

  throw new Error('All PGs failed');
}
```

---

## 7. Merchant Transaction Analytics API

### Endpoints

**`GET /api/transactions`** — Paginated transaction list
```
Query: ?page=1&limit=20&status=success&pg_name=razorpay&from=2026-07-01&to=2026-07-30
Response: { transactions: TransactionLog[], total, page, pages }
```

**`GET /api/transactions/analytics`** — Aggregate stats
```
Query: ?from=2026-07-01&to=2026-07-30
Response: {
  total_attempts: 1542,
  successful: 1486,
  failed: 56,
  success_rate: 96.4,
  total_volume: 8945000,
  avg_order_value: 6020,
  payment_methods: { upi: 60, card: 25, bank_transfer: 15 },
  pg_breakdown: [
    { pg_name: "razorpay", success_rate: 96.2, attempts: 1200, volume: 7200000 },
    { pg_name: "cashfree", success_rate: 94.1, attempts: 342, volume: 1745000 }
  ]
}
```

**`GET /api/transactions/:id`** — Single transaction detail (full PG request/response)
```
Response: TransactionLog with all fields including pg_raw_request, pg_raw_response
```

**`GET /api/orders?merchant_order_id=X`** — Find order by merchant's order ID

---

## 8. Implementation Priority

| # | Feature | Priority | Dependencies |
|---|---|---|---|
| 1 | Order ID generator (`OF-YYMMDD-NNNNNN`) | High | None |
| 2 | `merchant_order_id` in session + order schemas | High | None |
| 3 | Updated order schema with PG correlation fields | High | #1 |
| 4 | Session update/retry/expire endpoints | High | None |
| 5 | Session audit log | High | #4 |
| 6 | Transaction log schema + storage on every payment attempt | High | #3 |
| 7 | Order lookup by `merchant_order_id` | High | #2, #3 |
| 8 | PG stats schema + aggregation | Medium | #6 |
| 9 | Smart router service | Medium | #8, PG adapters |
| 10 | Fallback chain (auto-retry on next PG) | Medium | #9 |
| 11 | Transaction list API (`GET /api/transactions`) | Medium | #6 |
| 12 | Transaction analytics API (`GET /api/transactions/analytics`) | Medium | #8 |
| 13 | Session expiry cron job | Low | None |
| 14 | Webhook log storage | Low | PG adapters |
