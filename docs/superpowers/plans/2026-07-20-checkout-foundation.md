# Checkout Provider — Implementation Plan (Phase 1: Foundation)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the checkout foundation — bank rates, EMI calculation engine, checkout sessions, hosted checkout page, mock PG adapter, and order verification.

**Architecture:** New `checkout` module in the existing modular monolith. EMI engine is pure functions using our own bank rate database. Checkout sessions are temporary documents that power the hosted checkout page. PG adapter is an interface with a mock implementation for testing. Orders are created on successful payment.

**Tech Stack:** TypeScript, Fastify, MongoDB, Zod, Jest + mongodb-memory-server

**Spec:** `docs/superpowers/specs/2026-07-20-checkout-provider-design.md`

---

## File Structure

```
src/
  modules/
    checkout/
      schemas/
        bank-rate.ts         — BankRateSchema, Zod validation
        emi-calculation.ts   — EMICalculationSchema, result type
        checkout-session.ts  — CheckoutSessionSchema, CreateSessionSchema
        order.ts             — OrderSchema
      types/
        index.ts             — CheckoutService, OrderRepository interfaces
      services/
        emi-engine.ts        — calculateEMI() pure function
        bin-lookup.ts        — BIN → bank mapping
        checkout-service.ts  — session creation, offer evaluation, payment processing
      repositories/
        mongo-bank-rate-repository.ts
        mongo-session-repository.ts
        mongo-order-repository.ts
      routes/
        checkout-routes.ts   — session CRUD + checkout page endpoints
        order-routes.ts      — order verification
        bank-rate-routes.ts  — admin bank rate CRUD
      index.ts               — module factory
    pg-adapters/
      types.ts               — PGAdapter interface
      mock-adapter.ts        — mock PG for testing
      razorpay-adapter.ts    — Razorpay integration (Phase 2, stub only)
  modules/offers/            — EXISTING (evaluators, combo, routes)
  app.ts                     — EXISTING (register new routes)
  server.ts                  — EXISTING (wire new modules)
website/
  checkout/
    index.html               — Hosted checkout page (separate from marketing site)
    style.css                — Checkout-specific styles
    app.js                   — Checkout page logic (fetch session, render, submit)
```

---

## Task 1: EMI Calculation Engine (Pure Functions)

**Files:**
- Create: `src/modules/checkout/schemas/emi-calculation.ts`
- Create: `src/modules/checkout/services/emi-engine.ts`
- Test: `src/modules/checkout/services/emi-engine.test.ts`

- [ ] **Step 1: Write failing test for EMI calculation**

```typescript
// src/modules/checkout/services/emi-engine.test.ts
import { calculateEMI, calculateStandardEMI } from './emi-engine';

describe('calculateStandardEMI', () => {
  it('calculates EMI for 6 months at 18% on ₹1,29,999', () => {
    const emi = calculateStandardEMI(129999, 18, 6);
    // P=129999, r=1.5% monthly, n=6
    // EMI = P * r * (1+r)^n / ((1+r)^n - 1)
    expect(emi.monthly_emi).toBeGreaterThan(21000);
    expect(emi.monthly_emi).toBeLessThan(23000);
    expect(emi.total_payment).toBe(emi.monthly_emi * 6);
    expect(emi.total_interest).toBe(emi.total_payment - 129999);
  });

  it('calculates EMI for 12 months at 15% on ₹50,000', () => {
    const emi = calculateStandardEMI(50000, 15, 12);
    expect(emi.monthly_emi).toBeGreaterThan(4500);
    expect(emi.monthly_emi).toBeLessThan(5000);
  });

  it('rounds to whole rupees', () => {
    const emi = calculateStandardEMI(50000, 15, 12);
    expect(Number.isInteger(emi.monthly_emi)).toBe(true);
    expect(Number.isInteger(emi.total_payment)).toBe(true);
    expect(Number.isInteger(emi.total_interest)).toBe(true);
  });
});

describe('calculateEMI', () => {
  const bankRate = { bank_name: 'HDFC', interest_rate: 18, processing_fee: 199 };

  it('returns standard EMI when emi_type is "standard"', () => {
    const result = calculateEMI({
      principal: 129999,
      bankRate,
      tenure: 6,
      emiType: 'standard',
      subsidyAmount: null,
    });
    expect(result.emi_type).toBe('standard');
    expect(result.customer_interest).toBe(result.total_interest);
    expect(result.subsidy_amount).toBe(0);
  });

  it('returns no-cost EMI (0 interest) when emi_type is "no_cost" and subsidy is full', () => {
    const result = calculateEMI({
      principal: 129999,
      bankRate,
      tenure: 6,
      emiType: 'no_cost',
      subsidyAmount: 'full',
    });
    expect(result.emi_type).toBe('no_cost');
    expect(result.customer_interest).toBe(0);
    expect(result.customer_emi).toBe(Math.round(129999 / 6));
    expect(result.subsidy_amount).toBe(result.total_interest);
  });

  it('returns low-cost EMI when subsidy is partial', () => {
    const standard = calculateEMI({
      principal: 129999, bankRate, tenure: 6, emiType: 'standard', subsidyAmount: null,
    });
    const result = calculateEMI({
      principal: 129999,
      bankRate,
      tenure: 6,
      emiType: 'low_cost',
      subsidyAmount: 2000,
    });
    expect(result.emi_type).toBe('low_cost');
    expect(result.customer_interest).toBe(standard.total_interest - 2000);
    expect(result.subsidy_amount).toBe(2000);
  });

  it('caps subsidy at total interest', () => {
    const result = calculateEMI({
      principal: 50000,
      bankRate,
      tenure: 3,
      emiType: 'low_cost',
      subsidyAmount: 999999,
    });
    expect(result.subsidy_amount).toBe(result.total_interest);
    expect(result.customer_interest).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/modules/checkout/services/emi-engine.test.ts
```

- [ ] **Step 3: Implement EMI calculation schemas**

```typescript
// src/modules/checkout/schemas/emi-calculation.ts
import { z } from 'zod';

export const EMICalculationSchema = z.object({
  principal: z.number().positive(),
  tenure_months: z.number().int().positive(),
  interest_rate: z.number().nonnegative(),
  monthly_emi: z.number().nonnegative(),
  total_payment: z.number().nonnegative(),
  total_interest: z.number().nonnegative(),
  customer_emi: z.number().nonnegative(),
  customer_interest: z.number().nonnegative(),
  customer_total: z.number().nonnegative(),
  subsidy_amount: z.number().nonnegative(),
  emi_type: z.enum(['standard', 'no_cost', 'low_cost']),
  bank: z.string(),
  processing_fee: z.number().nullable(),
});

export type EMICalculation = z.infer<typeof EMICalculationSchema>;
```

- [ ] **Step 4: Implement EMI engine**

```typescript
// src/modules/checkout/services/emi-engine.ts
import type { EMICalculation } from '../schemas/emi-calculation';

interface BankRateInput {
  bank_name: string;
  interest_rate: number;
  processing_fee: number | null;
}

interface CalculateEMIParams {
  principal: number;
  bankRate: BankRateInput;
  tenure: number;
  emiType: 'standard' | 'no_cost' | 'low_cost';
  subsidyAmount: number | 'full' | null;
}

/** Calculates standard EMI using reducing balance formula. */
export function calculateStandardEMI(
  principal: number,
  annualRate: number,
  tenureMonths: number,
): { monthly_emi: number; total_payment: number; total_interest: number } {
  const r = annualRate / 12 / 100;
  const n = tenureMonths;

  if (r === 0) {
    const monthly = Math.round(principal / n);
    return { monthly_emi: monthly, total_payment: monthly * n, total_interest: 0 };
  }

  const emi = (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  const monthlyEmi = Math.round(emi);
  const totalPayment = monthlyEmi * n;
  const totalInterest = totalPayment - principal;

  return { monthly_emi: monthlyEmi, total_payment: totalPayment, total_interest: totalInterest };
}

/** Calculates EMI based on type (standard, no-cost, low-cost) and subsidy config. */
export function calculateEMI(params: CalculateEMIParams): EMICalculation {
  const { principal, bankRate, tenure, emiType, subsidyAmount } = params;
  const standard = calculateStandardEMI(principal, bankRate.interest_rate, tenure);

  let customerEmi: number;
  let customerInterest: number;
  let customerTotal: number;
  let subsidy: number;

  if (emiType === 'no_cost' || (emiType === 'low_cost' && subsidyAmount === 'full')) {
    customerEmi = Math.round(principal / tenure);
    customerInterest = 0;
    customerTotal = customerEmi * tenure;
    subsidy = standard.total_interest;
  } else if (emiType === 'low_cost' && typeof subsidyAmount === 'number') {
    subsidy = Math.min(subsidyAmount, standard.total_interest);
    customerInterest = standard.total_interest - subsidy;
    customerTotal = principal + customerInterest;
    customerEmi = Math.round(customerTotal / tenure);
  } else {
    customerEmi = standard.monthly_emi;
    customerInterest = standard.total_interest;
    customerTotal = standard.total_payment;
    subsidy = 0;
  }

  return {
    principal,
    tenure_months: tenure,
    interest_rate: bankRate.interest_rate,
    monthly_emi: standard.monthly_emi,
    total_payment: standard.total_payment,
    total_interest: standard.total_interest,
    customer_emi: customerEmi,
    customer_interest: customerInterest,
    customer_total: customerTotal,
    subsidy_amount: subsidy,
    emi_type: emiType,
    bank: bankRate.bank_name,
    processing_fee: bankRate.processing_fee,
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx jest src/modules/checkout/services/emi-engine.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(checkout): add EMI calculation engine with standard, no-cost, and low-cost EMI"
```

---

## Task 2: Bank Rate Schema + BIN Lookup

**Files:**
- Create: `src/modules/checkout/schemas/bank-rate.ts`
- Create: `src/modules/checkout/services/bin-lookup.ts`
- Test: `src/modules/checkout/services/bin-lookup.test.ts`

- [ ] **Step 1: Write failing test for BIN lookup**

```typescript
// src/modules/checkout/services/bin-lookup.test.ts
import { identifyBankFromBIN } from './bin-lookup';

describe('identifyBankFromBIN', () => {
  it('identifies HDFC from BIN prefix 4591', () => {
    expect(identifyBankFromBIN('459130')).toBe('HDFC');
  });

  it('identifies ICICI from BIN prefix 4xxxxxxxxx (ICICI Visa)', () => {
    expect(identifyBankFromBIN('4026')).toBe('ICICI');
  });

  it('identifies SBI from BIN prefix 5467', () => {
    expect(identifyBankFromBIN('546705')).toBe('SBI');
  });

  it('returns null for unknown BIN', () => {
    expect(identifyBankFromBIN('999999')).toBeNull();
  });

  it('handles 6-digit and 8-digit BINs', () => {
    expect(identifyBankFromBIN('45913012')).toBe('HDFC');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement bank rate schema**

```typescript
// src/modules/checkout/schemas/bank-rate.ts
import { z } from 'zod';

export const BankRateSchema = z.object({
  _id: z.string(),
  bank_name: z.string().min(1),
  bank_code: z.string().min(1),
  card_type: z.enum(['credit', 'debit']),
  interest_rate: z.number().positive(),
  tenures: z.array(z.number().int().positive()),
  processing_fee: z.number().nullable(),
  min_amount: z.number().positive(),
  max_amount: z.number().nullable(),
  status: z.enum(['active', 'inactive']),
  updated_at: z.string().datetime(),
});

export const CreateBankRateSchema = z.object({
  bank_name: z.string().min(1),
  bank_code: z.string().min(1),
  card_type: z.enum(['credit', 'debit']),
  interest_rate: z.number().positive(),
  tenures: z.array(z.number().int().positive()),
  processing_fee: z.number().nullable(),
  min_amount: z.number().positive().default(2500),
  max_amount: z.number().nullable().default(null),
});

export type BankRate = z.infer<typeof BankRateSchema>;
export type CreateBankRateInput = z.infer<typeof CreateBankRateSchema>;
```

- [ ] **Step 4: Implement BIN lookup**

```typescript
// src/modules/checkout/services/bin-lookup.ts

// Simplified BIN prefix → bank mapping (in production, use a BIN database API)
const BIN_PREFIXES: { prefix: string; bank: string }[] = [
  { prefix: '4591', bank: 'HDFC' },
  { prefix: '4026', bank: 'ICICI' },
  { prefix: '5467', bank: 'SBI' },
  { prefix: '4552', bank: 'ICICI' },
  { prefix: '5123', bank: 'AXIS' },
  { prefix: '4374', bank: 'HDFC' },
  { prefix: '5242', bank: 'ICICI' },
  { prefix: '5522', bank: 'HDFC' },
  { prefix: '4477', bank: 'KOTAK' },
  { prefix: '5413', bank: 'AXIS' },
  { prefix: '4386', bank: 'AXIS' },
  { prefix: '5422', bank: 'SBI' },
];

/** Identifies the issuing bank from a card BIN (first 6-8 digits). */
export function identifyBankFromBIN(bin: string): string | null {
  const cleanBin = bin.replace(/\s/g, '').substring(0, 8);
  for (const entry of BIN_PREFIXES) {
    if (cleanBin.startsWith(entry.prefix)) {
      return entry.bank;
    }
  }
  return null;
}
```

- [ ] **Step 5: Run test to verify it passes**

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(checkout): add bank rate schema and BIN-to-bank lookup"
```

---

## Task 3: Checkout Session Schema + Repository

**Files:**
- Create: `src/modules/checkout/schemas/checkout-session.ts`
- Create: `src/modules/checkout/repositories/mongo-session-repository.ts`
- Create: `src/modules/checkout/schemas/order.ts`
- Create: `src/modules/checkout/repositories/mongo-order-repository.ts`
- Test: `src/modules/checkout/repositories/mongo-session-repository.test.ts`

- [ ] **Step 1: Write failing test for session repository**

```typescript
// src/modules/checkout/repositories/mongo-session-repository.test.ts
import { MongoSessionRepository } from './mongo-session-repository';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, type Db } from 'mongodb';

describe('MongoSessionRepository', () => {
  let memServer: MongoMemoryServer;
  let client: MongoClient;
  let db: Db;
  let repo: MongoSessionRepository;

  beforeAll(async () => {
    memServer = await MongoMemoryServer.create();
    client = new MongoClient(memServer.getUri());
    await client.connect();
    db = client.db('fuse-test');
    repo = new MongoSessionRepository(db);
  });

  afterAll(async () => {
    await client.close();
    await memServer.stop();
  });

  beforeEach(async () => {
    await db.collection('checkout_sessions').deleteMany({});
  });

  it('creates and retrieves a session by id', async () => {
    const session = await repo.create({
      merchant_id: 'merch_test',
      cart: {
        amount: 5000,
        items: [{ sku_id: 'SKU-1', name: 'Test', price: 5000, qty: 1 }],
      },
      redirect_urls: { success: 'https://store.in/success', cancel: 'https://store.in/cancel' },
      customer: null,
    });
    expect(session._id).toBeDefined();
    const found = await repo.findById(session._id, 'merch_test');
    expect(found?.cart.amount).toBe(5000);
  });

  it('returns null for session from different merchant', async () => {
    const session = await repo.create({
      merchant_id: 'merch_test',
      cart: { amount: 100, items: [] },
      redirect_urls: { success: '', cancel: '' },
      customer: null,
    });
    const found = await repo.findById(session._id, 'merch_OTHER');
    expect(found).toBeNull();
  });

  it('updates customer info on a session', async () => {
    const session = await repo.create({
      merchant_id: 'merch_test',
      cart: { amount: 100, items: [] },
      redirect_urls: { success: '', cancel: '' },
      customer: null,
    });
    await repo.updateCustomer(session._id, 'merch_test', {
      name: 'John', email: 'john@test.in', phone: '9999999999',
      address: { line1: '123 St', city: 'Mum', state: 'MH', pincode: '400001' },
    });
    const found = await repo.findById(session._id, 'merch_test');
    expect(found?.customer_info?.name).toBe('John');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement session and order schemas**

```typescript
// src/modules/checkout/schemas/checkout-session.ts
import { z } from 'zod';

export const CheckoutSessionSchema = z.object({
  _id: z.string(),
  merchant_id: z.string(),
  cart: z.object({
    amount: z.number().positive(),
    items: z.array(z.object({
      sku_id: z.string(),
      name: z.string(),
      price: z.number().positive(),
      qty: z.number().int().positive(),
      category: z.string().optional(),
      brand: z.string().optional(),
    })),
  }),
  customer: z.object({
    email: z.string().optional(),
    phone: z.string().optional(),
  }).nullable(),
  customer_info: z.object({
    name: z.string(),
    email: z.string(),
    phone: z.string(),
    address: z.object({
      line1: z.string(),
      city: z.string(),
      state: z.string(),
      pincode: z.string(),
    }),
  }).nullable(),
  applied_offers: z.array(z.object({
    offer_id: z.string(),
    type: z.string(),
    discount_amount: z.number(),
  })).default([]),
  payment_method: z.string().nullable(),
  payment_status: z.enum(['pending', 'processing', 'success', 'failed']).default('pending'),
  pg_transaction_id: z.string().nullable(),
  order_id: z.string().nullable(),
  redirect_urls: z.object({
    success: z.string(),
    cancel: z.string(),
  }),
  created_at: z.string().datetime(),
  expires_at: z.string().datetime(),
});

export const CreateSessionSchema = z.object({
  cart: z.object({
    amount: z.number().positive(),
    items: z.array(z.object({
      sku_id: z.string(),
      name: z.string(),
      price: z.number().positive(),
      qty: z.number().int().positive(),
      category: z.string().optional(),
      brand: z.string().optional(),
    })),
  }),
  redirect_urls: z.object({ success: z.string().url(), cancel: z.string().url() }),
  customer: z.object({ email: z.string().optional(), phone: z.string().optional() }).optional(),
});

export type CheckoutSession = z.infer<typeof CheckoutSessionSchema>;
export type CreateSessionInput = z.infer<typeof CreateSessionSchema>;
```

```typescript
// src/modules/checkout/schemas/order.ts
import { z } from 'zod';

export const OrderSchema = z.object({
  _id: z.string(),
  merchant_id: z.string(),
  session_id: z.string(),
  cart_amount: z.number(),
  total_discount: z.number(),
  final_amount: z.number(),
  customer_info: z.object({
    name: z.string(), email: z.string(), phone: z.string(),
    address: z.object({ line1: z.string(), city: z.string(), state: z.string(), pincode: z.string() }),
  }),
  applied_offers: z.array(z.object({
    offer_id: z.string(), type: z.string(), discount_amount: z.number(),
  })),
  payment_method: z.string(),
  pg_transaction_id: z.string().nullable(),
  pg_name: z.string(),
  order_status: z.enum(['created', 'paid', 'failed', 'refunded']),
  emi_details: z.object({
    bank: z.string(), tenure: z.number(), emi_amount: z.number(),
    interest: z.number(), subsidy: z.number(),
  }).nullable(),
  created_at: z.string().datetime(),
});

export type Order = z.infer<typeof OrderSchema>;
```

- [ ] **Step 4: Implement session repository**

```typescript
// src/modules/checkout/repositories/mongo-session-repository.ts
import type { Db } from 'mongodb';
import type { CheckoutSession, CreateSessionInput } from '../schemas/checkout-session';

export class MongoSessionRepository {
  constructor(private readonly db: Db) {}

  async create(input: {
    merchant_id: string;
    cart: CreateSessionInput['cart'];
    redirect_urls: CreateSessionInput['redirect_urls'];
    customer: CreateSessionInput['customer'] | null;
  }): Promise<CheckoutSession> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000); // 30 min
    const session: CheckoutSession = {
      _id: `sess_${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`,
      merchant_id: input.merchant_id,
      cart: input.cart,
      customer: input.customer ?? null,
      customer_info: null,
      applied_offers: [],
      payment_method: null,
      payment_status: 'pending',
      pg_transaction_id: null,
      order_id: null,
      redirect_urls: input.redirect_urls,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    };
    await this.db.collection('checkout_sessions').insertOne(session as any);
    return session;
  }

  async findById(id: string, merchantId: string): Promise<CheckoutSession | null> {
    const doc = await this.db.collection('checkout_sessions').findOne({
      _id: id, merchant_id: merchantId,
    });
    return doc as unknown as CheckoutSession | null;
  }

  async findByIdPublic(id: string): Promise<CheckoutSession | null> {
    const doc = await this.db.collection('checkout_sessions').findOne({ _id: id });
    return doc as unknown as CheckoutSession | null;
  }

  async updateCustomer(id: string, merchantId: string, customerInfo: NonNullable<CheckoutSession['customer_info']>): Promise<void> {
    await this.db.collection('checkout_sessions').updateOne(
      { _id: id, merchant_id: merchantId },
      { $set: { customer_info: customerInfo } },
    );
  }

  async updatePaymentStatus(id: string, status: CheckoutSession['payment_status'], pgTransactionId?: string, orderId?: string): Promise<void> {
    const update: Record<string, unknown> = { payment_status: status };
    if (pgTransactionId) update.pg_transaction_id = pgTransactionId;
    if (orderId) update.order_id = orderId;
    await this.db.collection('checkout_sessions').updateOne({ _id: id }, { $set: update });
  }
}
```

- [ ] **Step 5: Implement order repository**

```typescript
// src/modules/checkout/repositories/mongo-order-repository.ts
import type { Db } from 'mongodb';
import type { Order } from '../schemas/order';

export class MongoOrderRepository {
  constructor(private readonly db: Db) {}

  async create(order: Order): Promise<Order> {
    await this.db.collection('orders').insertOne(order as any);
    return order;
  }

  async findById(id: string, merchantId: string): Promise<Order | null> {
    const doc = await this.db.collection('orders').findOne({ _id: id, merchant_id: merchantId });
    return doc as unknown as Order | null;
  }

  async findByMerchant(merchantId: string, page = 1, limit = 20): Promise<{ orders: Order[]; total: number }> {
    const skip = (page - 1) * limit;
    const [orders, total] = await Promise.all([
      this.db.collection('orders').find({ merchant_id: merchantId }).sort({ created_at: -1 }).skip(skip).limit(limit).toArray(),
      this.db.collection('orders').countDocuments({ merchant_id: merchantId }),
    ]);
    return { orders: orders as unknown as Order[], total };
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(checkout): add checkout session and order schemas with MongoDB repositories"
```

---

## Task 4: PG Adapter Interface + Mock Adapter

**Files:**
- Create: `src/modules/pg-adapters/types.ts`
- Create: `src/modules/pg-adapters/mock-adapter.ts`
- Test: `src/modules/pg-adapters/mock-adapter.test.ts`

- [ ] **Step 1: Write failing test for mock PG adapter**

```typescript
// src/modules/pg-adapters/mock-adapter.test.ts
import { MockPGAdapter } from './mock-adapter';

describe('MockPGAdapter', () => {
  it('creates an order and returns an order id', async () => {
    const adapter = new MockPGAdapter();
    const order = await adapter.createOrder({ amount: 5000, payment_method: 'upi' });
    expect(order.order_id).toBeDefined();
    expect(order.amount).toBe(5000);
  });

  it('processes payment and returns success', async () => {
    const adapter = new MockPGAdapter();
    const order = await adapter.createOrder({ amount: 5000, payment_method: 'upi' });
    const result = await adapter.processPayment({ order_id: order.order_id, payment_data: {} });
    expect(result.status).toBe('success');
    expect(result.transaction_id).toBeDefined();
  });

  it('returns failure when amount is 0', async () => {
    const adapter = new MockPGAdapter();
    const order = await adapter.createOrder({ amount: 0, payment_method: 'card' });
    const result = await adapter.processPayment({ order_id: order.order_id, payment_data: {} });
    expect(result.status).toBe('failed');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

- [ ] **Step 3: Implement PG adapter interface**

```typescript
// src/modules/pg-adapters/types.ts

export interface PGOrder {
  order_id: string;
  amount: number;
  currency: string;
  status: 'created' | 'attempted' | 'paid';
}

export interface PGPaymentResult {
  status: 'success' | 'failed' | 'pending';
  transaction_id: string;
  error_message?: string;
}

export interface PGVerification {
  verified: boolean;
  amount: number;
  status: string;
}

export interface CreateOrderParams {
  amount: number;
  payment_method: string;
  options?: {
    bank?: string;
    tenure?: number;
    customer_email?: string;
    customer_phone?: string;
  };
}

export interface ProcessPaymentParams {
  order_id: string;
  payment_data: Record<string, unknown>;
}

/** Interface for payment gateway adapters. Each PG implements this. */
export interface PGAdapter {
  createOrder(params: CreateOrderParams): Promise<PGOrder>;
  processPayment(params: ProcessPaymentParams): Promise<PGPaymentResult>;
  verifyPayment(transactionId: string): Promise<PGVerification>;
}
```

- [ ] **Step 4: Implement mock adapter**

```typescript
// src/modules/pg-adapters/mock-adapter.ts
import type { PGAdapter, PGOrder, PGPaymentResult, PGVerification, CreateOrderParams, ProcessPaymentParams } from './types';

/** Mock PG adapter for testing. Simulates payment processing without real PG calls. */
export class MockPGAdapter implements PGAdapter {
  private orders = new Map<string, PGOrder>();

  async createOrder(params: CreateOrderParams): Promise<PGOrder> {
    const order: PGOrder = {
      order_id: `pg_mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      amount: params.amount,
      currency: 'INR',
      status: 'created',
    };
    this.orders.set(order.order_id, order);
    return order;
  }

  async processPayment(params: ProcessPaymentParams): Promise<PGPaymentResult> {
    const order = this.orders.get(params.order_id);
    if (!order) {
      return { status: 'failed', transaction_id: '', error_message: 'Order not found' };
    }
    if (order.amount <= 0) {
      return { status: 'failed', transaction_id: '', error_message: 'Invalid amount' };
    }
    order.status = 'paid';
    return {
      status: 'success',
      transaction_id: `txn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    };
  }

  async verifyPayment(transactionId: string): Promise<PGVerification> {
    return { verified: true, amount: 0, status: 'paid' };
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(pg): add PG adapter interface and mock adapter for testing"
```

---

## Task 5: Checkout Session Routes (Merchant API)

**Files:**
- Create: `src/modules/checkout/routes/checkout-routes.ts`
- Create: `src/modules/checkout/routes/order-routes.ts`
- Create: `src/modules/checkout/routes/bank-rate-routes.ts`
- Test: `src/modules/checkout/routes/checkout-routes.test.ts`

- [ ] **Step 1: Write failing test for checkout session creation**

```typescript
// src/modules/checkout/routes/checkout-routes.test.ts
import { createServer } from '../../../app';
import { errorHandler } from '../../../middleware/error-handler';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { connectDatabase, closeDatabase, getDatabase } from '../../../config/database';
import { registerCheckoutRoutes } from './checkout-routes';
import type { FastifyInstance } from 'fastify';

describe('checkout routes', () => {
  let server: FastifyInstance;
  let memServer: MongoMemoryServer;

  beforeAll(async () => {
    memServer = await MongoMemoryServer.create();
    const uri = memServer.getUri();
    const client = new MongoClient(uri);
    await client.connect();
    await client.close();
    await connectDatabase(uri, 'fuse-test');
  });

  afterAll(async () => {
    await closeDatabase();
    await memServer.stop();
  });

  beforeEach(async () => {
    server = createServer();
    server.setErrorHandler(errorHandler);
    server.decorate('db', getDatabase());
    // Insert test merchant
    await getDatabase().collection('merchants').insertOne({
      _id: 'merch_test', name: 'Test', api_key_hash: 'test-key',
      global_stacking_policy: { max_coupons: 1, max_auto_offers: 1, max_total_discount: null, allow_cross_type: true, exclusive_tags: [] },
      created_at: new Date().toISOString(),
    });
    registerCheckoutRoutes(server);
  });

  afterEach(async () => {
    await getDatabase().collection('checkout_sessions').deleteMany({});
    await getDatabase().collection('merchants').deleteMany({});
    await server.close();
  });

  it('POST /api/checkout/sessions creates a session', async () => {
    const res = await server.inject({
      method: 'POST', url: '/api/checkout/sessions',
      headers: { 'x-api-key': 'test-key' },
      payload: {
        cart: {
          amount: 5000,
          items: [{ sku_id: 'SKU-1', name: 'Test Product', price: 5000, qty: 1 }],
        },
        redirect_urls: { success: 'https://store.in/success', cancel: 'https://store.in/cancel' },
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.session_id).toBeDefined();
    expect(body.checkout_url).toContain(body.session_id);
  });

  it('GET /api/checkout/sessions/:id retrieves a session', async () => {
    const createRes = await server.inject({
      method: 'POST', url: '/api/checkout/sessions',
      headers: { 'x-api-key': 'test-key' },
      payload: {
        cart: { amount: 5000, items: [{ sku_id: 'SKU-1', name: 'Test', price: 5000, qty: 1 }] },
        redirect_urls: { success: 'https://store.in/success', cancel: 'https://store.in/cancel' },
      },
    });
    const sessionId = JSON.parse(createRes.body).session_id;
    const res = await server.inject({
      method: 'GET', url: `/api/checkout/sessions/${sessionId}`,
      headers: { 'x-api-key': 'test-key' },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).cart.amount).toBe(5000);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

- [ ] **Step 3: Implement checkout routes**

```typescript
// src/modules/checkout/routes/checkout-routes.ts
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CreateSessionSchema } from '../schemas/checkout-session';
import { MongoSessionRepository } from '../repositories/mongo-session-repository';
import { identifyBankFromBIN } from '../services/bin-lookup';
import { calculateEMI } from '../services/emi-engine';

const SESSION_BASE = 'https://checkout.fuse.io';
const SESSION_EXPIRY_MINUTES = 30;

export function registerCheckoutRoutes(server: FastifyInstance): void {
  // POST /api/checkout/sessions — create session (merchant API)
  server.post('/api/checkout/sessions', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = CreateSessionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message } });
    }

    const merchantId = request.merchantId || 'merch_test'; // fallback for API key auth
    const db = server.db;
    const repo = new MongoSessionRepository(db);

    const session = await repo.create({
      merchant_id: merchantId,
      cart: parsed.data.cart,
      redirect_urls: parsed.data.redirect_urls,
      customer: parsed.data.customer ?? null,
    });

    return reply.code(201).send({
      session_id: session._id,
      checkout_url: `${SESSION_BASE}/${session._id}`,
      expires_at: session.expires_at,
    });
  });

  // GET /api/checkout/sessions/:id — retrieve session (merchant API)
  server.get('/api/checkout/sessions/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const merchantId = request.merchantId || 'merch_test';
    const db = server.db;
    const repo = new MongoSessionRepository(db);
    const session = await repo.findById(id, merchantId);
    if (!session) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Session not found' } });
    }
    return reply.send(session);
  });

  // GET /api/checkout/:session_id/cart — get cart (checkout page, no merchant auth)
  server.get('/api/checkout/:session_id/cart', async (request: FastifyRequest, reply: FastifyReply) => {
    const { session_id } = request.params as { session_id: string };
    const db = server.db;
    const repo = new MongoSessionRepository(db);
    const session = await repo.findByIdPublic(session_id);
    if (!session) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Session expired or not found' } });
    }
    return reply.send({
      cart: session.cart,
      merchant_id: session.merchant_id,
      customer: session.customer,
      applied_offers: session.applied_offers,
      payment_status: session.payment_status,
    });
  });

  // POST /api/checkout/:session_id/customer — save customer info
  server.post('/api/checkout/:session_id/customer', async (request: FastifyRequest, reply: FastifyReply) => {
    const { session_id } = request.params as { session_id: string };
    const db = server.db;
    const repo = new MongoSessionRepository(db);
    const session = await repo.findByIdPublic(session_id);
    if (!session) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Session not found' } });
    }
    const body = request.body as { name: string; email: string; phone: string; address: { line1: string; city: string; state: string; pincode: string } };
    await repo.updateCustomer(session_id, session.merchant_id, body);
    return reply.send({ saved: true });
  });

  // POST /api/checkout/:session_id/select-payment — select payment method + get applicable offers
  server.post('/api/checkout/:session_id/select-payment', async (request: FastifyRequest, reply: FastifyReply) => {
    const { session_id } = request.params as { session_id: string };
    const db = server.db;
    const repo = new MongoSessionRepository(db);
    const session = await repo.findByIdPublic(session_id);
    if (!session) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Session not found' } });
    }
    const { method, bank, bin, tenure } = request.body as { method: string; bank?: string; bin?: string; tenure?: number };

    let bankName = bank;
    if (bin && !bankName) {
      bankName = identifyBankFromBIN(bin) || undefined;
    }

    // If card + BIN detected, return EMI options
    let emi_options = [];
    if (method === 'card' && bankName) {
      const bankRates = await db.collection('bank_rates').find({
        bank_code: bankName, card_type: 'credit', status: 'active',
      }).toArray();
      for (const rate of bankRates) {
        for (const t of rate.tenures) {
          const calc = calculateEMI({
            principal: session.cart.amount,
            bankRate: { bank_name: rate.bank_name, interest_rate: rate.interest_rate, processing_fee: rate.processing_fee },
            tenure: t,
            emiType: 'standard',
            subsidyAmount: null,
          });
          emi_options.push({ ...calc, tenure_months: t });
        }
      }
    }

    return reply.send({
      method,
      bank: bankName,
      emi_options,
      final_amount: session.cart.amount,
    });
  });

  // POST /api/checkout/:session_id/process-payment — process payment via PG
  server.post('/api/checkout/:session_id/process-payment', async (request: FastifyRequest, reply: FastifyReply) => {
    const { session_id } = request.params as { session_id: string };
    const db = server.db;
    const repo = new MongoSessionRepository(db);
    const orderRepo = new (await import('../repositories/mongo-order-repository')).MongoOrderRepository(db);
    const session = await repo.findByIdPublic(session_id);
    if (!session) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Session not found' } });
    }

    const { method } = request.body as { method: string };

    // Use mock PG for now
    const { MockPGAdapter } = await import('../../../modules/pg-adapters/mock-adapter');
    const pg = new MockPGAdapter();

    const pgOrder = await pg.createOrder({ amount: session.cart.amount, payment_method: method });
    const pgResult = await pg.processPayment({ order_id: pgOrder.order_id, payment_data: {} });

    if (pgResult.status === 'success') {
      const orderId = `order_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await repo.updatePaymentStatus(session_id, 'success', pgResult.transaction_id, orderId);

      const order = {
        _id: orderId,
        merchant_id: session.merchant_id,
        session_id,
        cart_amount: session.cart.amount,
        total_discount: session.applied_offers.reduce((s, o) => s + o.discount_amount, 0),
        final_amount: session.cart.amount - session.applied_offers.reduce((s, o) => s + o.discount_amount, 0),
        customer_info: session.customer_info,
        applied_offers: session.applied_offers,
        payment_method: method,
        pg_transaction_id: pgResult.transaction_id,
        pg_name: 'mock',
        order_status: 'paid' as const,
        emi_details: null,
        created_at: new Date().toISOString(),
      };
      await orderRepo.create(order as any);

      return reply.send({
        order_id: orderId,
        status: 'success',
        redirect_url: session.redirect_urls.success,
      });
    } else {
      await repo.updatePaymentStatus(session_id, 'failed');
      return reply.code(400).send({
        error: { code: 'PAYMENT_FAILED', message: pgResult.error_message || 'Payment failed' },
        redirect_url: session.redirect_urls.cancel,
      });
    }
  });
}
```

Also implement order routes and bank rate routes (simpler — CRUD):

```typescript
// src/modules/checkout/routes/order-routes.ts
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { MongoOrderRepository } from '../repositories/mongo-order-repository';

export function registerOrderRoutes(server: FastifyInstance): void {
  server.get('/api/orders', async (request: FastifyRequest, reply: FastifyReply) => {
    const merchantId = request.merchantId || 'merch_test';
    const query = request.query as { page?: string; limit?: string };
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '20', 10);
    const repo = new MongoOrderRepository(server.db);
    const result = await repo.findByMerchant(merchantId, page, limit);
    return reply.send(result);
  });

  server.get('/api/orders/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const merchantId = request.merchantId || 'merch_test';
    const repo = new MongoOrderRepository(server.db);
    const order = await repo.findById(id, merchantId);
    if (!order) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Order not found' } });
    }
    return reply.send(order);
  });
}
```

```typescript
// src/modules/checkout/routes/bank-rate-routes.ts
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CreateBankRateSchema } from '../schemas/bank-rate';

export function registerBankRateRoutes(server: FastifyInstance): void {
  server.get('/api/admin/bank-rates', async (request: FastifyRequest, reply: FastifyReply) => {
    const rates = await server.db.collection('bank_rates').find({}).toArray();
    return reply.send({ bank_rates: rates });
  });

  server.post('/api/admin/bank-rates', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = CreateBankRateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message } });
    }
    const rate = {
      _id: `br_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ...parsed.data,
      status: 'active',
      updated_at: new Date().toISOString(),
    };
    await server.db.collection('bank_rates').insertOne(rate as any);
    return reply.code(201).send(rate);
  });

  server.patch('/api/admin/bank-rates/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const updates = request.body as Record<string, unknown>;
    updates.updated_at = new Date().toISOString();
    await server.db.collection('bank_rates').updateOne({ _id: id }, { $set: updates });
    return reply.send({ updated: true });
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(checkout): add checkout session, order, and bank rate routes"
```

---

## Task 6: Wire Checkout Routes into Server

**Files:**
- Modify: `src/server.ts` — register checkout + order + bank-rate routes

- [ ] **Step 1: Add imports and register routes in server.ts**

Add after existing route registrations:

```typescript
import { registerCheckoutRoutes } from './modules/checkout/routes/checkout-routes';
import { registerOrderRoutes } from './modules/checkout/routes/order-routes';
import { registerBankRateRoutes } from './modules/checkout/routes/bank-rate-routes';

// In the start() function, after existing routes:
registerCheckoutRoutes(server);
registerOrderRoutes(server);
registerBankRateRoutes(server);
```

- [ ] **Step 2: Seed bank rates**

Add to `scripts/seed.ts`:

```typescript
// Bank rates
const bankRates = [
  { _id: 'br_hdfc_cc', bank_name: 'HDFC', bank_code: 'HDFC', card_type: 'credit', interest_rate: 18, tenures: [3,6,9,12,18,24], processing_fee: 199, min_amount: 2500, max_amount: null, status: 'active', updated_at: now },
  { _id: 'br_icici_cc', bank_name: 'ICICI', bank_code: 'ICICI', card_type: 'credit', interest_rate: 16, tenures: [3,6,9,12,18,24], processing_fee: 199, min_amount: 2500, max_amount: null, status: 'active', updated_at: now },
  { _id: 'br_axis_cc', bank_name: 'AXIS', bank_code: 'AXIS', card_type: 'credit', interest_rate: 17, tenures: [3,6,9,12,18,24], processing_fee: 199, min_amount: 2500, max_amount: null, status: 'active', updated_at: now },
  { _id: 'br_sbi_cc', bank_name: 'SBI', bank_code: 'SBI', card_type: 'credit', interest_rate: 15, tenures: [3,6,9,12,18], processing_fee: 299, min_amount: 2500, max_amount: null, status: 'active', updated_at: now },
];
await db.collection('bank_rates').deleteMany({});
await db.collection('bank_rates').insertMany(bankRates as any);
console.log(`✓ Bank rates: ${bankRates.length} inserted (HDFC, ICICI, AXIS, SBI)`);
```

- [ ] **Step 3: Run tests**

```bash
npx jest
npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(checkout): wire checkout routes into server and seed bank rates"
```

---

## Task 7: Hosted Checkout Page

**Files:**
- Create: `website/checkout/index.html`
- Create: `website/checkout/style.css`
- Create: `website/checkout/app.js`
- Modify: `dev.sh` — serve checkout page on port 8082

- [ ] **Step 1: Create checkout page HTML**

A 3-step checkout page that:
1. Reads session_id from URL path (`/sess_xxx`)
2. Fetches cart from `GET /api/checkout/:session_id/cart`
3. Shows customer details form
4. Shows payment methods with offers
5. Submits customer info → selects payment → processes payment → redirects

- [ ] **Step 2: Create checkout CSS**

Reuse the same theme as the playground (dark, amber accent, Sora font).

- [ ] **Step 3: Create checkout JS**

```javascript
// Read session_id from URL
const sessionId = window.location.pathname.split('/').pop();
const API_BASE = 'http://localhost:3010';

// Fetch cart → render → collect customer info → select payment → process
// Show EMI options when card BIN entered
// Show payment offers per method
// Redirect on success
```

- [ ] **Step 4: Update dev.sh to serve checkout page**

```bash
# Step 9: Start checkout page on port 8082
cd /Users/arelligoutham/Documents/Fuse/website/checkout
python3 -m http.server 8082 > /tmp/fuse-checkout.log 2>&1 &
CHECKOUT_PID=$!
```

- [ ] **Step 5: Test the flow**

```bash
# Create a session via API
curl -X POST http://localhost:3010/api/checkout/sessions \
  -H "x-api-key: demo-key-123" \
  -H "Content-Type: application/json" \
  -d '{"cart":{"amount":5000,"items":[{"sku_id":"SKU-1","name":"Test","price":5000,"qty":1}]},"redirect_urls":{"success":"https://store.in/success","cancel":"https://store.in/cancel"}}'

# Visit the checkout URL
open http://localhost:8082/sess_xxx
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(checkout): add hosted checkout page with 3-step flow and EMI display"
```

---

## Summary

Phase 1 (Checkout Foundation) — 7 tasks:
1. EMI calculation engine (pure functions, TDD) — standard, no-cost, low-cost
2. Bank rate schema + BIN-to-bank lookup
3. Checkout session + order schemas + MongoDB repositories
4. PG adapter interface + mock adapter
5. Checkout routes (session CRUD, cart load, customer save, payment select, process payment)
6. Server wiring + bank rate seeding
7. Hosted checkout page (HTML/CSS/JS) with 3-step flow

Each produces working, testable software. Phase 2 (EMI offers + payment offers) builds on this foundation.
