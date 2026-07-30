# Fuse Core Engine — Implementation Plan (Part 1 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure-logic rule engine, offer evaluators, and combo resolver for Fuse's coupons & auto-offers module — no database, no API, just testable TypeScript.

**Architecture:** Modular monolith with interface-only communication. Rule evaluators are pure functions. OfferEvaluatorRegistry routes offers to type-specific evaluators (CouponEvaluator, AutoOfferEvaluator). ComboResolver resolves stacking conflicts using merchant policy + per-offer overrides. All types derived from Zod schemas.

**Tech Stack:** TypeScript (strict), Zod (validation + type inference), Jest (TDD), ESLint strict, Prettier

**Spec:** `docs/superpowers/specs/2026-07-18-coupons-module-design.md`
**Engineering practices:** `.github/copilot-instructions.md`

---

## File Structure

```
src/
  config/
    index.ts                    — app config (brandName, etc.) from env vars
  lib/
    errors.ts                   — typed error classes (OfferNotFoundError, etc.)
    money.ts                    — currency rounding utilities (whole rupees)
  modules/
    offers/
      types/
        index.ts                — PUBLIC CONTRACT: OfferService, OfferRepository interfaces
        offer.ts                — Offer type (z.infer from OfferSchema)
        evaluation-context.ts   — EvaluationContext type (z.infer from schema)
        evaluation-result.ts    — EvaluationResult type (z.infer from schema)
        combo.ts                — StackingPolicy, ComboResult types
      schemas/
        offer.ts                — Zod schemas: OfferSchema, CreateOfferInputSchema
        evaluation.ts           — Zod schemas: EvaluationContextSchema, EvaluationResultSchema
        combo.ts                — Zod schemas: StackingPolicySchema, ComboResultSchema
        discount.ts             — Zod schemas: DiscountSchema (shared)
        cart.ts                 — Zod schemas: CartSchema, CartItemSchema (shared)
        customer.ts             — Zod schemas: CustomerContextSchema (shared)
      rules/
        index.ts                — RuleEvaluatorRegistry: maps rule_type → evaluator function
        types.ts                — RuleEvaluator type signature
        min-cart-value.ts       — min_cart_value rule
        max-cart-value.ts       — max_cart_value rule
        customer-segment.ts     — customer_segment rule
        first-time-buyer.ts     — first_time_buyer rule
        per-customer-limit.ts   — per_customer_limit rule
        total-usage-limit.ts    — total_usage_limit rule
        category-restriction.ts — category_restriction rule
        product-restriction.ts  — product_restriction rule
        brand-restriction.ts    — brand_restriction rule
        product-combo.ts        — product_combo rule
        time-window.ts          — time_window rule
        weekend-only.ts         — weekend_only rule
        date-range.ts           — date_range rule
      evaluators/
        index.ts                — OfferEvaluatorRegistry: maps offer type → evaluator
        types.ts                — OfferEvaluator interface
        coupon-evaluator.ts     — CouponEvaluator (implements OfferEvaluator)
        auto-offer-evaluator.ts — AutoOfferEvaluator (implements OfferEvaluator)
      combo/
        combo-resolver.ts       — ComboResolver.resolve() implementation
        index.ts                — exports ComboResolver interface + implementation
      index.ts                  — module public exports (interfaces + types only)
  index.ts                      — barrel export for config, lib, modules
package.json
tsconfig.json
jest.config.ts
.eslintrc.json
.prettierrc
```

---

## Task 1: Project Scaffold & Tooling

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `jest.config.ts`
- Create: `.eslintrc.json`
- Create: `.prettierrc`
- Create: `.gitignore`
- Create: `src/config/index.ts`
- Create: `src/index.ts`

- [ ] **Step 1: Initialize npm project and install dependencies**

```bash
cd /Users/arelligoutham/Documents/Fuse
npm init -y
npm install zod
npm install -D typescript @types/node tsx jest @types/jest ts-jest \
  eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser \
  prettier eslint-config-prettier
```

- [ ] **Step 2: Create tsconfig.json (strict mode)**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "node",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

- [ ] **Step 3: Create jest.config.ts**

```typescript
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/index.ts',
  ],
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 },
  },
};

export default config;
```

- [ ] **Step 4: Create .eslintrc.json**

```json
{
  "parser": "@typescript-eslint/parser",
  "parserOptions": { "ecmaVersion": 2022, "sourceType": "module" },
  "plugins": ["@typescript-eslint"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/strict",
    "prettier"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-floating-promises": "error",
    "prefer-const": "error",
    "@typescript-eslint/consistent-type-imports": ["error", { "prefer": "type-imports" }]
  }
}
```

- [ ] **Step 5: Create .prettierrc**

```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 80,
  "tabWidth": 2
}
```

- [ ] **Step 6: Create .gitignore**

```
node_modules/
dist/
coverage/
.env
.env.local
*.log
.superpowers/
```

- [ ] **Step 7: Create src/config/index.ts**

```typescript
/**
 * Application configuration loaded from environment variables.
 * Brand name is configurable — never hardcode it elsewhere.
 */
export const config = {
  brandName: process.env.BRAND_NAME ?? 'Fuse',
  brandLogoUrl: process.env.BRAND_LOGO_URL ?? '',
  brandPrimaryColor: process.env.BRAND_PRIMARY_COLOR ?? '#4F46E5',
  brandSupportEmail: process.env.BRAND_SUPPORT_EMAIL ?? 'support@fuse.io',
  brandDomain: process.env.BRAND_DOMAIN ?? 'fuse.io',
} as const;
```

- [ ] **Step 8: Create src/index.ts (barrel export)**

```typescript
export { config } from './config/index';
```

- [ ] **Step 9: Add npm scripts to package.json**

Add these to the `scripts` section of package.json:

```json
{
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src --ext .ts",
    "format": "prettier --write src",
    "format:check": "prettier --check src",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 10: Verify the scaffold compiles and tests run**

```bash
npx tsc --noEmit
npx jest --version
```

Expected: No TypeScript errors. Jest version printed.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "chore: scaffold TypeScript project with Jest, ESLint, Prettier, Zod"
```

---

## Task 2: Shared Schemas — Cart, Customer, Discount

**Files:**
- Create: `src/modules/offers/schemas/cart.ts`
- Create: `src/modules/offers/schemas/customer.ts`
- Create: `src/modules/offers/schemas/discount.ts`
- Test: `src/modules/offers/schemas/cart.test.ts`
- Test: `src/modules/offers/schemas/customer.test.ts`
- Test: `src/modules/offers/schemas/discount.test.ts`

- [ ] **Step 1: Write failing test for CartSchema**

```typescript
// src/modules/offers/schemas/cart.test.ts
import { CartSchema, CartItemSchema } from './cart';

describe('CartItemSchema', () => {
  it('parses a valid cart item', () => {
    const item = {
      sku_id: 'SKU-IP15',
      category: 'electronics',
      brand: 'Apple',
      price: 99999,
      qty: 1,
    };
    expect(CartItemSchema.parse(item)).toEqual(item);
  });

  it('rejects negative price', () => {
    const item = { sku_id: 'SKU-1', price: -100, qty: 1 };
    expect(() => CartItemSchema.parse(item)).toThrow();
  });

  it('rejects zero qty', () => {
    const item = { sku_id: 'SKU-1', price: 100, qty: 0 };
    expect(() => CartItemSchema.parse(item)).toThrow();
  });

  it('accepts item with optional fields omitted', () => {
    const item = { sku_id: 'SKU-1', price: 100, qty: 1 };
    expect(CartItemSchema.parse(item)).toEqual(item);
  });
});

describe('CartSchema', () => {
  it('parses a valid cart with items', () => {
    const cart = {
      amount: 5000,
      items: [{ sku_id: 'SKU-1', price: 5000, qty: 1 }],
    };
    expect(CartSchema.parse(cart)).toEqual(cart);
  });

  it('parses a cart with empty items array', () => {
    const cart = { amount: 0, items: [] };
    expect(CartSchema.parse(cart)).toEqual(cart);
  });

  it('rejects negative cart amount', () => {
    expect(() => CartSchema.parse({ amount: -1, items: [] })).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/modules/offers/schemas/cart.test.ts
```

Expected: FAIL — module `./cart` not found.

- [ ] **Step 3: Implement CartSchema**

```typescript
// src/modules/offers/schemas/cart.ts
import { z } from 'zod';

/**
 * Schema for a single item in a shopping cart.
 * sku_id is required; category, brand are optional (some merchants don't classify products).
 */
export const CartItemSchema = z.object({
  sku_id: z.string().min(1),
  category: z.string().optional(),
  brand: z.string().optional(),
  price: z.number().positive(),
  qty: z.number().int().positive(),
});

/**
 * Schema for a shopping cart passed to the rule engine.
 * amount is the cart total (sum of item.price * item.qty).
 */
export const CartSchema = z.object({
  amount: z.number().nonnegative(),
  items: z.array(CartItemSchema),
});

/** Cart item type — inferred from schema, single source of truth. */
export type CartItem = z.infer<typeof CartItemSchema>;

/** Cart type — inferred from schema. */
export type Cart = z.infer<typeof CartSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest src/modules/offers/schemas/cart.test.ts
```

Expected: PASS — all 7 tests pass.

- [ ] **Step 5: Write failing test for CustomerContextSchema**

```typescript
// src/modules/offers/schemas/customer.test.ts
import { CustomerContextSchema } from './customer';

describe('CustomerContextSchema', () => {
  it('parses a full customer context', () => {
    const ctx = {
      customer_id: 'cust_123',
      segments: ['new', 'returning'],
      total_orders: 3,
      per_customer_used: 1,
    };
    expect(CustomerContextSchema.parse(ctx)).toEqual(ctx);
  });

  it('parses with empty segments and zero orders (new customer)', () => {
    const ctx = {
      customer_id: 'cust_new',
      segments: [],
      total_orders: 0,
      per_customer_used: 0,
    };
    expect(CustomerContextSchema.parse(ctx)).toEqual(ctx);
  });

  it('rejects negative total_orders', () => {
    expect(() =>
      CustomerContextSchema.parse({
        customer_id: 'cust_1',
        segments: [],
        total_orders: -1,
        per_customer_used: 0,
      }),
    ).toThrow();
  });

  it('rejects negative per_customer_used', () => {
    expect(() =>
      CustomerContextSchema.parse({
        customer_id: 'cust_1',
        segments: [],
        total_orders: 0,
        per_customer_used: -1,
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

```bash
npx jest src/modules/offers/schemas/customer.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 7: Implement CustomerContextSchema**

```typescript
// src/modules/offers/schemas/customer.ts
import { z } from 'zod';

/**
 * Customer context passed to the rule engine.
 * Contains the data rules need to evaluate customer-based conditions:
 * - segments: auto-computed ("new", "returning", "vip") + custom
 * - total_orders: paid order count with this merchant (for first_time_buyer)
 * - per_customer_used: how many times this customer has used this offer
 */
export const CustomerContextSchema = z.object({
  customer_id: z.string().min(1),
  segments: z.array(z.string()),
  total_orders: z.number().int().nonnegative(),
  per_customer_used: z.number().int().nonnegative(),
});

/** Customer context type — inferred from schema. */
export type CustomerContext = z.infer<typeof CustomerContextSchema>;
```

- [ ] **Step 8: Run test to verify it passes**

```bash
npx jest src/modules/offers/schemas/customer.test.ts
```

Expected: PASS — all 4 tests pass.

- [ ] **Step 9: Write failing test for DiscountSchema**

```typescript
// src/modules/offers/schemas/discount.test.ts
import { DiscountSchema, computeDiscount } from './discount';

describe('DiscountSchema', () => {
  it('parses a flat discount', () => {
    const d = { type: 'flat', value: 50, max_discount: null };
    expect(DiscountSchema.parse(d)).toEqual(d);
  });

  it('parses a percentage discount with cap', () => {
    const d = { type: 'percentage', value: 10, max_discount: 500 };
    expect(DiscountSchema.parse(d)).toEqual(d);
  });

  it('parses a percentage discount without cap', () => {
    const d = { type: 'percentage', value: 10, max_discount: null };
    expect(DiscountSchema.parse(d)).toEqual(d);
  });

  it('rejects negative discount value', () => {
    expect(() =>
      DiscountSchema.parse({ type: 'flat', value: -50, max_discount: null }),
    ).toThrow();
  });

  it('rejects percentage over 100', () => {
    expect(() =>
      DiscountSchema.parse({ type: 'percentage', value: 150, max_discount: null }),
    ).toThrow();
  });
});

describe('computeDiscount', () => {
  it('returns flat value directly when below cart amount', () => {
    const d = { type: 'flat' as const, value: 50, max_discount: null };
    expect(computeDiscount(d, 5000)).toBe(50);
  });

  it('returns cart amount when flat exceeds cart', () => {
    const d = { type: 'flat' as const, value: 5000, max_discount: null };
    expect(computeDiscount(d, 100)).toBe(100);
  });

  it('returns percentage of cart', () => {
    const d = { type: 'percentage' as const, value: 10, max_discount: null };
    expect(computeDiscount(d, 5000)).toBe(500);
  });

  it('caps percentage discount at max_discount', () => {
    const d = { type: 'percentage' as const, value: 10, max_discount: 300 };
    expect(computeDiscount(d, 5000)).toBe(300);
  });

  it('does not cap when percentage result is below max_discount', () => {
    const d = { type: 'percentage' as const, value: 10, max_discount: 300 };
    expect(computeDiscount(d, 2000)).toBe(200);
  });
});
```

- [ ] **Step 10: Run test to verify it fails**

```bash
npx jest src/modules/offers/schemas/discount.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 11: Implement DiscountSchema and computeDiscount**

```typescript
// src/modules/offers/schemas/discount.ts
import { z } from 'zod';

/**
 * Schema for a discount configuration on an offer.
 * - flat: fixed amount off (e.g., ₹50 off)
 * - percentage: percentage of cart amount (e.g., 10% off)
 *   max_discount caps the percentage result (e.g., 10% off up to ₹500)
 */
export const DiscountSchema = z.object({
  type: z.enum(['flat', 'percentage']),
  value: z.number().positive(),
  max_discount: z.number().positive().nullable(),
});

/** Discount type — inferred from schema. */
export type Discount = z.infer<typeof DiscountSchema>;

/**
 * Computes the actual discount amount for a given cart amount.
 * - Flat: returns min(value, cartAmount) — never discount more than the cart.
 * - Percentage: returns value% of cartAmount, capped at max_discount if set.
 *
 * @param discount - Discount configuration
 * @param cartAmount - Total cart amount in rupees
 * @returns Discount amount in whole rupees (never negative, never exceeds cart)
 */
export function computeDiscount(discount: Discount, cartAmount: number): number {
  if (discount.type === 'flat') {
    return Math.min(discount.value, cartAmount);
  }

  const percentageAmount = Math.round((cartAmount * discount.value) / 100);

  if (discount.max_discount !== null) {
    return Math.min(percentageAmount, discount.max_discount);
  }

  return percentageAmount;
}
```

- [ ] **Step 12: Run test to verify it passes**

```bash
npx jest src/modules/offers/schemas/discount.test.ts
```

Expected: PASS — all 10 tests pass.

- [ ] **Step 13: Run all tests, lint, typecheck**

```bash
npx jest
npm run lint
npm run typecheck
```

Expected: All tests pass, no lint errors, no type errors.

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "feat(schemas): add Cart, Customer, Discount Zod schemas with computeDiscount"
```

---

## Task 3: Offer Schema & Evaluation Schemas

**Files:**
- Create: `src/modules/offers/schemas/offer.ts`
- Create: `src/modules/offers/schemas/evaluation.ts`
- Test: `src/modules/offers/schemas/offer.test.ts`
- Test: `src/modules/offers/schemas/evaluation.test.ts`

- [ ] **Step 1: Write failing test for OfferSchema**

```typescript
// src/modules/offers/schemas/offer.test.ts
import { OfferSchema, RuleSchema } from './offer';

describe('RuleSchema', () => {
  it('parses a min_cart_value rule', () => {
    const rule = { rule_type: 'min_cart_value', config: { min_amount: 500 } };
    expect(RuleSchema.parse(rule)).toEqual(rule);
  });

  it('parses a customer_segment rule', () => {
    const rule = {
      rule_type: 'customer_segment',
      config: { segments: ['new', 'vip'] },
    };
    expect(RuleSchema.parse(rule)).toEqual(rule);
  });

  it('parses a time_window rule', () => {
    const rule = {
      rule_type: 'time_window',
      config: { days: ['sat', 'sun'], start_hour: 0, end_hour: 23 },
    };
    expect(RuleSchema.parse(rule)).toEqual(rule);
  });

  it('parses a product_combo rule', () => {
    const rule = {
      rule_type: 'product_combo',
      config: { skus: ['SKU-1', 'SKU-2'] },
    };
    expect(RuleSchema.parse(rule)).toEqual(rule);
  });

  it('parses a date_range rule', () => {
    const rule = {
      rule_type: 'date_range',
      config: { start_date: '2026-07-01', end_date: '2026-07-31' },
    };
    expect(RuleSchema.parse(rule)).toEqual(rule);
  });
});

describe('OfferSchema', () => {
  const validOffer = {
    _id: 'offer_123',
    merchant_id: 'merch_abc',
    code: 'FLAT50',
    type: 'coupon',
    title: 'Flat ₹50 off',
    description: 'Get ₹50 off on orders above ₹500',
    discount: { type: 'flat', value: 50, max_discount: null },
    subsidy_model: 'merchant',
    status: 'active',
    validity: {
      starts_at: '2026-07-01T00:00:00.000Z',
      ends_at: '2026-12-31T23:59:59.000Z',
    },
    usage_limits: { total: 1000, per_customer: 2 },
    usage_count: 0,
    rules: [{ rule_type: 'min_cart_value', config: { min_amount: 500 } }],
    stacking: { stacks_with: null, exclusive: false, priority: 0 },
    tags: [],
    created_at: '2026-07-18T09:00:00.000Z',
    updated_at: '2026-07-18T09:00:00.000Z',
  };

  it('parses a valid coupon offer', () => {
    expect(OfferSchema.parse(validOffer)).toEqual(validOffer);
  });

  it('parses an auto-offer with null code', () => {
    const autoOffer = { ...validOffer, _id: 'offer_456', code: null, type: 'auto_offer' };
    expect(OfferSchema.parse(autoOffer)).toEqual(autoOffer);
  });

  it('rejects unknown offer type', () => {
    expect(() =>
      OfferSchema.parse({ ...validOffer, type: 'unknown_type' }),
    ).toThrow();
  });

  it('rejects unknown rule_type', () => {
    expect(() =>
      OfferSchema.parse({
        ...validOffer,
        rules: [{ rule_type: 'unknown_rule', config: {} }],
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/modules/offers/schemas/offer.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement RuleSchema and OfferSchema**

```typescript
// src/modules/offers/schemas/offer.ts
import { z } from 'zod';
import { DiscountSchema } from './discount';

/**
 * Schema for a rule attached to an offer.
 * rule_type determines which evaluator function processes it.
 * config is an object whose shape depends on rule_type (validated by the rule evaluator).
 */
export const RuleSchema = z.object({
  rule_type: z.enum([
    'min_cart_value',
    'max_cart_value',
    'customer_segment',
    'first_time_buyer',
    'per_customer_limit',
    'total_usage_limit',
    'category_restriction',
    'product_restriction',
    'brand_restriction',
    'product_combo',
    'time_window',
    'weekend_only',
    'date_range',
  ]),
  config: z.record(z.string(), z.unknown()),
});

/**
 * Schema for an offer (coupon or auto-offer).
 * code is null for auto_offers (they're discovered, not entered by code).
 * subsidy_model defaults to "merchant" for v1 — bank/brand use future values.
 */
export const OfferSchema = z.object({
  _id: z.string(),
  merchant_id: z.string(),
  code: z.string().nullable(),
  type: z.enum(['coupon', 'auto_offer']),
  title: z.string(),
  description: z.string().optional(),
  discount: DiscountSchema,
  subsidy_model: z.enum(['merchant', 'bank', 'brand', 'split']).default('merchant'),
  status: z.enum(['active', 'inactive', 'expired']),
  validity: z.object({
    starts_at: z.string().datetime(),
    ends_at: z.string().datetime(),
  }),
  usage_limits: z.object({
    total: z.number().int().positive().nullable(),
    per_customer: z.number().int().positive().nullable(),
  }),
  usage_count: z.number().int().nonnegative().default(0),
  rules: z.array(RuleSchema),
  stacking: z.object({
    stacks_with: z.array(z.string()).nullable(),
    exclusive: z.boolean().default(false),
    priority: z.number().int().default(0),
  }).default({ stacks_with: null, exclusive: false, priority: 0 }),
  tags: z.array(z.string()).default([]),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

/** Rule type — inferred from schema. */
export type Rule = z.infer<typeof RuleSchema>;

/** Offer type — inferred from schema. */
export type Offer = z.infer<typeof OfferSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest src/modules/offers/schemas/offer.test.ts
```

Expected: PASS — all 9 tests pass.

- [ ] **Step 5: Write failing test for EvaluationContextSchema and EvaluationResultSchema**

```typescript
// src/modules/offers/schemas/evaluation.test.ts
import {
  EvaluationContextSchema,
  EvaluationResultSchema,
} from './evaluation';

describe('EvaluationContextSchema', () => {
  it('parses a full evaluation context', () => {
    const ctx = {
      cart: { amount: 5000, items: [{ sku_id: 'SKU-1', price: 5000, qty: 1 }] },
      customer: {
        customer_id: 'cust_1',
        segments: ['new'],
        total_orders: 0,
        per_customer_used: 0,
      },
      merchant: {
        stacking_policy: {
          max_coupons: 1,
          max_auto_offers: 1,
          max_total_discount: null,
          allow_cross_type: true,
          exclusive_tags: [],
        },
      },
      usage: { per_customer_used: 0, total_used: 0 },
      now: '2026-07-18T10:00:00.000Z',
    };
    expect(EvaluationContextSchema.parse(ctx)).toEqual(ctx);
  });

  it('parses context with empty cart', () => {
    const ctx = {
      cart: { amount: 0, items: [] },
      customer: {
        customer_id: 'cust_1',
        segments: [],
        total_orders: 0,
        per_customer_used: 0,
      },
      merchant: {
        stacking_policy: {
          max_coupons: 1,
          max_auto_offers: 1,
          max_total_discount: null,
          allow_cross_type: true,
          exclusive_tags: [],
        },
      },
      usage: { per_customer_used: 0, total_used: 0 },
      now: '2026-07-18T10:00:00.000Z',
    };
    expect(EvaluationContextSchema.parse(ctx)).toEqual(ctx);
  });
});

describe('EvaluationResultSchema', () => {
  it('parses an eligible result with discount', () => {
    const result = {
      eligible: true,
      matched_rules: ['min_cart_value', 'customer_segment'],
      failed_rule: null,
      reason: null,
      discount: { type: 'flat', value: 50, max_discount: null, amount: 50 },
    };
    expect(EvaluationResultSchema.parse(result)).toEqual(result);
  });

  it('parses an ineligible result with reason', () => {
    const result = {
      eligible: false,
      matched_rules: [],
      failed_rule: 'min_cart_value',
      reason: 'Cart amount ₹300 is below minimum ₹500',
      discount: null,
    };
    expect(EvaluationResultSchema.parse(result)).toEqual(result);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

```bash
npx jest src/modules/offers/schemas/evaluation.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 7: Implement EvaluationContextSchema and EvaluationResultSchema**

```typescript
// src/modules/offers/schemas/evaluation.ts
import { z } from 'zod';
import { CartSchema } from './cart';
import { CustomerContextSchema } from './customer';
import { DiscountSchema } from './discount';

/**
 * Schema for the merchant's global stacking policy.
 * - max_coupons: max coupon codes per order
 * - max_auto_offers: max auto-applied offers per order
 * - max_total_discount: optional cap on total discount amount
 * - allow_cross_type: can a coupon + auto-offer stack?
 * - exclusive_tags: offers with these tags can't stack with anything
 */
export const StackingPolicySchema = z.object({
  max_coupons: z.number().int().positive(),
  max_auto_offers: z.number().int().positive(),
  max_total_discount: z.number().positive().nullable(),
  allow_cross_type: z.boolean(),
  exclusive_tags: z.array(z.string()),
});

/**
 * Schema for the context passed to rule evaluators and offer evaluators.
 * Contains everything needed to evaluate an offer: cart, customer, merchant policy,
 * usage data, and the current timestamp.
 */
export const EvaluationContextSchema = z.object({
  cart: CartSchema,
  customer: CustomerContextSchema,
  merchant: z.object({
    stacking_policy: StackingPolicySchema,
  }),
  usage: z.object({
    per_customer_used: z.number().int().nonnegative(),
    total_used: z.number().int().nonnegative(),
  }),
  now: z.string().datetime(),
});

/**
 * Schema for the discount with computed amount — returned in EvaluationResult.
 */
export const ComputedDiscountSchema = DiscountSchema.extend({
  amount: z.number().nonnegative(),
});

/**
 * Schema for the result of evaluating an offer against a context.
 * - eligible: true if all rules passed
 * - matched_rules: rule_types that passed
 * - failed_rule: first rule_type that failed (null if all passed)
 * - reason: human-readable failure reason (null if eligible)
 * - discount: computed discount if eligible, null otherwise
 */
export const EvaluationResultSchema = z.object({
  eligible: z.boolean(),
  matched_rules: z.array(z.string()),
  failed_rule: z.string().nullable(),
  reason: z.string().nullable(),
  discount: ComputedDiscountSchema.nullable(),
});

/** Evaluation context type — inferred from schema. */
export type EvaluationContext = z.infer<typeof EvaluationContextSchema>;

/** Evaluation result type — inferred from schema. */
export type EvaluationResult = z.infer<typeof EvaluationResultSchema>;

/** Stacking policy type — inferred from schema. */
export type StackingPolicy = z.infer<typeof StackingPolicySchema>;

/** Computed discount type — inferred from schema. */
export type ComputedDiscount = z.infer<typeof ComputedDiscountSchema>;
```

- [ ] **Step 8: Run test to verify it passes**

```bash
npx jest src/modules/offers/schemas/evaluation.test.ts
```

Expected: PASS — all 4 tests pass.

- [ ] **Step 9: Run all tests, lint, typecheck**

```bash
npx jest
npm run lint
npm run typecheck
```

Expected: All pass.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(schemas): add Offer, Rule, EvaluationContext, EvaluationResult schemas"
```

---

## Task 4: Money Utility & Typed Errors

**Files:**
- Create: `src/lib/money.ts`
- Create: `src/lib/errors.ts`
- Test: `src/lib/money.test.ts`
- Test: `src/lib/errors.test.ts`

- [ ] **Step 1: Write failing test for money utilities**

```typescript
// src/lib/money.test.ts
import { roundToRupee, formatRupee, min } from './money';

describe('roundToRupee', () => {
  it('rounds 4166.666 to 4167', () => {
    expect(roundToRupee(4166.666)).toBe(4167);
  });

  it('rounds 4166.4 to 4166', () => {
    expect(roundToRupee(4166.4)).toBe(4166);
  });

  it('rounds 0.5 to 1 (round half up)', () => {
    expect(roundToRupee(0.5)).toBe(1);
  });

  it('rounds 0.4 to 0', () => {
    expect(roundToRupee(0.4)).toBe(0);
  });

  it('handles zero', () => {
    expect(roundToRupee(0)).toBe(0);
  });
});

describe('formatRupee', () => {
  it('formats 50000 as ₹50,000', () => {
    expect(formatRupee(50000)).toBe('₹50,000');
  });

  it('formats 0 as ₹0', () => {
    expect(formatRupee(0)).toBe('₹0');
  });

  it('formats 999 as ₹999', () => {
    expect(formatRupee(999)).toBe('₹999');
  });
});

describe('min', () => {
  it('returns the smaller of two numbers', () => {
    expect(min(10, 20)).toBe(10);
  });

  it('handles equal values', () => {
    expect(min(50, 50)).toBe(50);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/lib/money.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement money utilities**

```typescript
// src/lib/money.ts

/**
 * Rounds a number to the nearest whole rupee (round half up).
 * EMI and discount amounts must never show paise — always whole rupees.
 *
 * @param amount - Amount in rupees (may have fractional paise)
 * @returns Whole rupee amount (integer)
 */
export function roundToRupee(amount: number): number {
  return Math.round(amount);
}

/**
 * Formats a rupee amount with the ₹ symbol and Indian-style comma grouping.
 * Example: 50000 → "₹50,000"
 *
 * @param amount - Amount in whole rupees
 * @returns Formatted string with ₹ prefix
 */
export function formatRupee(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

/**
 * Returns the minimum of two numbers.
 * Utility used by discount computations.
 *
 * @param a - First value
 * @param b - Second value
 * @returns The smaller value
 */
export function min(a: number, b: number): number {
  return a <= b ? a : b;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest src/lib/money.test.ts
```

Expected: PASS — all 8 tests pass.

- [ ] **Step 5: Write failing test for typed errors**

```typescript
// src/lib/errors.test.ts
import {
  OfferNotFoundError,
  OfferInvalidError,
  OfferIneligibleError,
  ComboConflictError,
  ValidationError,
  AuthError,
} from './errors';

describe('typed errors', () => {
  it('OfferNotFoundError has correct code and status', () => {
    const err = new OfferNotFoundError('FLAT50');
    expect(err.code).toBe('OFFER_NOT_FOUND');
    expect(err.statusCode).toBe(404);
    expect(err.message).toContain('FLAT50');
  });

  it('OfferInvalidError has correct code and status', () => {
    const err = new OfferInvalidError('Coupon expired');
    expect(err.code).toBe('OFFER_INVALID');
    expect(err.statusCode).toBe(422);
  });

  it('OfferIneligibleError has correct code and status', () => {
    const err = new OfferIneligibleError('Cart below minimum');
    expect(err.code).toBe('OFFER_INELIGIBLE');
    expect(err.statusCode).toBe(422);
  });

  it('ComboConflictError has correct code and status', () => {
    const err = new ComboConflictError('Cannot stack exclusive offers');
    expect(err.code).toBe('COMBO_CONFLICT');
    expect(err.statusCode).toBe(422);
  });

  it('ValidationError has correct code and status', () => {
    const err = new ValidationError('Invalid request body');
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.statusCode).toBe(400);
  });

  it('AuthError has correct code and status', () => {
    const err = new AuthError('Invalid API key');
    expect(err.code).toBe('AUTH_INVALID');
    expect(err.statusCode).toBe(401);
  });

  it('all errors extend Error', () => {
    expect(new OfferNotFoundError('x')).toBeInstanceOf(Error);
    expect(new ValidationError('x')).toBeInstanceOf(Error);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

```bash
npx jest src/lib/errors.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 7: Implement typed errors**

```typescript
// src/lib/errors.ts

/**
 * Base class for all Fuse typed errors.
 * Each error has a machine-readable code and an HTTP status code.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

/** Thrown when an offer ID or code doesn't exist (or belongs to another merchant). */
export class OfferNotFoundError extends AppError {
  constructor(identifier: string) {
    super(`Offer not found: ${identifier}`, 'OFFER_NOT_FOUND', 404);
  }
}

/** Thrown when an offer exists but is expired or usage-limited. */
export class OfferInvalidError extends AppError {
  constructor(reason: string) {
    super(reason, 'OFFER_INVALID', 422);
  }
}

/** Thrown when cart/customer doesn't meet offer rules. */
export class OfferIneligibleError extends AppError {
  constructor(reason: string) {
    super(reason, 'OFFER_INELIGIBLE', 422);
  }
}

/** Thrown when stacking policy forbids a combination. */
export class ComboConflictError extends AppError {
  constructor(reason: string) {
    super(reason, 'COMBO_CONFLICT', 422);
  }
}

/** Thrown when request body is malformed. */
export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

/** Thrown when API key is missing or invalid. */
export class AuthError extends AppError {
  constructor(message: string) {
    super(message, 'AUTH_INVALID', 401);
  }
}
```

- [ ] **Step 8: Run test to verify it passes**

```bash
npx jest src/lib/errors.test.ts
```

Expected: PASS — all 7 tests pass.

- [ ] **Step 9: Run all tests, lint, typecheck**

```bash
npx jest
npm run lint
npm run typecheck
```

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(lib): add money utilities and typed error classes"
```

---

## Task 5: Rule Evaluator Type & Registry

**Files:**
- Create: `src/modules/offers/rules/types.ts`
- Create: `src/modules/offers/rules/index.ts`
- Test: `src/modules/offers/rules/index.test.ts`

- [ ] **Step 1: Write failing test for RuleEvaluatorRegistry**

```typescript
// src/modules/offers/rules/index.test.ts
import { RuleEvaluatorRegistry } from './index';
import type { EvaluationContext } from '../schemas/evaluation';

// Mock context for tests
const mockContext: EvaluationContext = {
  cart: { amount: 5000, items: [{ sku_id: 'SKU-1', price: 5000, qty: 1 }] },
  customer: { customer_id: 'c1', segments: [], total_orders: 0, per_customer_used: 0 },
  merchant: {
    stacking_policy: {
      max_coupons: 1, max_auto_offers: 1,
      max_total_discount: null, allow_cross_type: true, exclusive_tags: [],
    },
  },
  usage: { per_customer_used: 0, total_used: 0 },
  now: '2026-07-18T10:00:00.000Z',
};

describe('RuleEvaluatorRegistry', () => {
  it('registers and calls a rule evaluator', () => {
    const registry = new RuleEvaluatorRegistry();
    registry.register('min_cart_value', (config, ctx) => {
      return ctx.cart.amount >= (config as { min_amount: number }).min_amount;
    });

    const rule = { rule_type: 'min_cart_value' as const, config: { min_amount: 500 } };
    expect(registry.evaluate(rule, mockContext)).toBe(true);
  });

  it('returns false when rule fails', () => {
    const registry = new RuleEvaluatorRegistry();
    registry.register('min_cart_value', (config, ctx) => {
      return ctx.cart.amount >= (config as { min_amount: number }).min_amount;
    });

    const rule = {
      rule_type: 'min_cart_value' as const,
      config: { min_amount: 10000 },
    };
    expect(registry.evaluate(rule, mockContext)).toBe(false);
  });

  it('throws when evaluating unregistered rule type', () => {
    const registry = new RuleEvaluatorRegistry();
    const rule = { rule_type: 'unknown' as never, config: {} };
    expect(() => registry.evaluate(rule, mockContext)).toThrow(/unknown/);
  });

  it('checks if a rule type is registered', () => {
    const registry = new RuleEvaluatorRegistry();
    registry.register('min_cart_value', () => true);
    expect(registry.has('min_cart_value')).toBe(true);
    expect(registry.has('unknown')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/modules/offers/rules/index.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement RuleEvaluator type**

```typescript
// src/modules/offers/rules/types.ts
import type { EvaluationContext } from '../schemas/evaluation';

/**
 * A rule evaluator is a pure function that checks one rule against the context.
 * Returns true if the rule passes, false if it fails.
 *
 * @param config - Rule-specific configuration (shape depends on rule_type)
 * @param context - Evaluation context (cart, customer, usage, timestamp)
 * @returns true if the rule condition is satisfied
 */
export type RuleEvaluator = (
  config: Record<string, unknown>,
  context: EvaluationContext,
) => boolean;
```

- [ ] **Step 4: Implement RuleEvaluatorRegistry**

```typescript
// src/modules/offers/rules/index.ts
import type { Rule } from '../schemas/offer';
import type { EvaluationContext } from '../schemas/evaluation';
import type { RuleEvaluator } from './types';

/**
 * Registry that maps rule_type strings to their evaluator functions.
 * New rule types are added by calling register() — no modifications to existing code.
 * This is the Open/Closed principle in action.
 */
export class RuleEvaluatorRegistry {
  private evaluators = new Map<string, RuleEvaluator>();

  /**
   * Registers a rule evaluator for a rule_type.
   * @param ruleType - The rule_type string (e.g., "min_cart_value")
   * @param evaluator - Pure function that evaluates the rule
   */
  register(ruleType: string, evaluator: RuleEvaluator): void {
    this.evaluators.set(ruleType, evaluator);
  }

  /**
   * Checks if a rule_type is registered.
   * @param ruleType - The rule_type string
   * @returns true if an evaluator is registered
   */
  has(ruleType: string): boolean {
    return this.evaluators.has(ruleType);
  }

  /**
   * Evaluates a single rule against the context.
   * @param rule - The rule to evaluate (must have a registered rule_type)
   * @param context - Evaluation context
   * @returns true if the rule passes
   * @throws Error if rule_type is not registered
   */
  evaluate(rule: Rule, context: EvaluationContext): boolean {
    const evaluator = this.evaluators.get(rule.rule_type);
    if (!evaluator) {
      throw new Error(`No evaluator registered for rule_type: ${rule.rule_type}`);
    }
    return evaluator(rule.config, context);
  }

  /**
   * Evaluates all rules in order. Returns the first failing rule_type, or null if all pass.
   * @param rules - Array of rules to evaluate
   * @param context - Evaluation context
   * @returns Object with passed (boolean) and failedRuleType (string | null)
   */
  evaluateAll(
    rules: Rule[],
    context: EvaluationContext,
  ): { passed: boolean; failedRuleType: string | null } {
    for (const rule of rules) {
      if (!this.evaluate(rule, context)) {
        return { passed: false, failedRuleType: rule.rule_type };
      }
    }
    return { passed: true, failedRuleType: null };
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx jest src/modules/offers/rules/index.test.ts
```

Expected: PASS — all 4 tests pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(rules): add RuleEvaluatorRegistry with register/evaluate/evaluateAll"
```

---

## Task 6: Rule Evaluators — Cart Value Rules (min_cart_value, max_cart_value)

**Files:**
- Create: `src/modules/offers/rules/min-cart-value.ts`
- Create: `src/modules/offers/rules/max-cart-value.ts`
- Test: `src/modules/offers/rules/min-cart-value.test.ts`
- Test: `src/modules/offers/rules/max-cart-value.test.ts`

- [ ] **Step 1: Write failing test for min_cart_value**

```typescript
// src/modules/offers/rules/min-cart-value.test.ts
import { minCartValue } from './min-cart-value';
import type { EvaluationContext } from '../schemas/evaluation';

function makeContext(cartAmount: number): EvaluationContext {
  return {
    cart: { amount: cartAmount, items: [] },
    customer: { customer_id: 'c1', segments: [], total_orders: 0, per_customer_used: 0 },
    merchant: {
      stacking_policy: {
        max_coupons: 1, max_auto_offers: 1,
        max_total_discount: null, allow_cross_type: true, exclusive_tags: [],
      },
    },
    usage: { per_customer_used: 0, total_used: 0 },
    now: '2026-07-18T10:00:00.000Z',
  };
}

describe('minCartValue', () => {
  it('passes when cart equals min_amount (boundary)', () => {
    expect(minCartValue({ min_amount: 500 }, makeContext(500))).toBe(true);
  });

  it('passes when cart exceeds min_amount', () => {
    expect(minCartValue({ min_amount: 500 }, makeContext(501))).toBe(true);
  });

  it('fails when cart is below min_amount', () => {
    expect(minCartValue({ min_amount: 500 }, makeContext(499))).toBe(false);
  });

  it('passes when min_amount is 0', () => {
    expect(minCartValue({ min_amount: 0 }, makeContext(0))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/modules/offers/rules/min-cart-value.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement minCartValue**

```typescript
// src/modules/offers/rules/min-cart-value.ts
import type { RuleEvaluator } from './types';

/**
 * Rule evaluator: min_cart_value
 * Checks if the cart total meets or exceeds the minimum amount threshold.
 *
 * @param config - Must contain { min_amount: number }
 * @param context - Evaluation context with cart data
 * @returns true if context.cart.amount >= config.min_amount
 */
export const minCartValue: RuleEvaluator = (config, context) => {
  const minAmount = (config as { min_amount: number }).min_amount;
  return context.cart.amount >= minAmount;
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest src/modules/offers/rules/min-cart-value.test.ts
```

Expected: PASS — all 4 tests pass.

- [ ] **Step 5: Write failing test for max_cart_value**

```typescript
// src/modules/offers/rules/max-cart-value.test.ts
import { maxCartValue } from './max-cart-value';
import type { EvaluationContext } from '../schemas/evaluation';

function makeContext(cartAmount: number): EvaluationContext {
  return {
    cart: { amount: cartAmount, items: [] },
    customer: { customer_id: 'c1', segments: [], total_orders: 0, per_customer_used: 0 },
    merchant: {
      stacking_policy: {
        max_coupons: 1, max_auto_offers: 1,
        max_total_discount: null, allow_cross_type: true, exclusive_tags: [],
      },
    },
    usage: { per_customer_used: 0, total_used: 0 },
    now: '2026-07-18T10:00:00.000Z',
  };
}

describe('maxCartValue', () => {
  it('passes when cart equals max_amount (boundary)', () => {
    expect(maxCartValue({ max_amount: 50000 }, makeContext(50000))).toBe(true);
  });

  it('passes when cart is below max_amount', () => {
    expect(maxCartValue({ max_amount: 50000 }, makeContext(49999))).toBe(true);
  });

  it('fails when cart exceeds max_amount', () => {
    expect(maxCartValue({ max_amount: 50000 }, makeContext(50001))).toBe(false);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

```bash
npx jest src/modules/offers/rules/max-cart-value.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 7: Implement maxCartValue**

```typescript
// src/modules/offers/rules/max-cart-value.ts
import type { RuleEvaluator } from './types';

/**
 * Rule evaluator: max_cart_value
 * Checks if the cart total is at or below the maximum amount threshold.
 *
 * @param config - Must contain { max_amount: number }
 * @param context - Evaluation context with cart data
 * @returns true if context.cart.amount <= config.max_amount
 */
export const maxCartValue: RuleEvaluator = (config, context) => {
  const maxAmount = (config as { max_amount: number }).max_amount;
  return context.cart.amount <= maxAmount;
};
```

- [ ] **Step 8: Run test to verify it passes**

```bash
npx jest src/modules/offers/rules/max-cart-value.test.ts
```

Expected: PASS — all 3 tests pass.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(rules): add min_cart_value and max_cart_value evaluators"
```

---

## Task 7: Rule Evaluators — Customer Rules (customer_segment, first_time_buyer)

**Files:**
- Create: `src/modules/offers/rules/customer-segment.ts`
- Create: `src/modules/offers/rules/first-time-buyer.ts`
- Test: `src/modules/offers/rules/customer-segment.test.ts`
- Test: `src/modules/offers/rules/first-time-buyer.test.ts`

- [ ] **Step 1: Write failing test for customer_segment**

```typescript
// src/modules/offers/rules/customer-segment.test.ts
import { customerSegment } from './customer-segment';
import type { EvaluationContext } from '../schemas/evaluation';

function makeContext(segments: string[]): EvaluationContext {
  return {
    cart: { amount: 1000, items: [] },
    customer: {
      customer_id: 'c1', segments, total_orders: 0, per_customer_used: 0,
    },
    merchant: {
      stacking_policy: {
        max_coupons: 1, max_auto_offers: 1,
        max_total_discount: null, allow_cross_type: true, exclusive_tags: [],
      },
    },
    usage: { per_customer_used: 0, total_used: 0 },
    now: '2026-07-18T10:00:00.000Z',
  };
}

describe('customerSegment', () => {
  it('passes when customer has one of the required segments', () => {
    expect(customerSegment({ segments: ['new', 'vip'] }, makeContext(['new']))).toBe(true);
  });

  it('passes when customer has all required segments', () => {
    expect(customerSegment({ segments: ['new', 'vip'] }, makeContext(['new', 'vip']))).toBe(true);
  });

  it('fails when customer has none of the required segments', () => {
    expect(customerSegment({ segments: ['vip'] }, makeContext(['new']))).toBe(false);
  });

  it('fails when customer has empty segments but rule requires one', () => {
    expect(customerSegment({ segments: ['new'] }, makeContext([]))).toBe(false);
  });

  it('passes when rule requires empty segments', () => {
    expect(customerSegment({ segments: [] }, makeContext(['new']))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/modules/offers/rules/customer-segment.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement customerSegment**

```typescript
// src/modules/offers/rules/customer-segment.ts
import type { RuleEvaluator } from './types';

/**
 * Rule evaluator: customer_segment
 * Checks if the customer belongs to at least one of the required segments.
 * Passes if rule.segments is empty (no restriction).
 *
 * @param config - Must contain { segments: string[] }
 * @param context - Evaluation context with customer data
 * @returns true if any customer segment matches any required segment
 */
export const customerSegment: RuleEvaluator = (config, context) => {
  const requiredSegments = (config as { segments: string[] }).segments;
  if (requiredSegments.length === 0) return true;
  return requiredSegments.some((s) => context.customer.segments.includes(s));
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest src/modules/offers/rules/customer-segment.test.ts
```

Expected: PASS — all 5 tests pass.

- [ ] **Step 5: Write failing test for first_time_buyer**

```typescript
// src/modules/offers/rules/first-time-buyer.test.ts
import { firstTimeBuyer } from './first-time-buyer';
import type { EvaluationContext } from '../schemas/evaluation';

function makeContext(totalOrders: number): EvaluationContext {
  return {
    cart: { amount: 1000, items: [] },
    customer: {
      customer_id: 'c1', segments: [], total_orders: totalOrders, per_customer_used: 0,
    },
    merchant: {
      stacking_policy: {
        max_coupons: 1, max_auto_offers: 1,
        max_total_discount: null, allow_cross_type: true, exclusive_tags: [],
      },
    },
    usage: { per_customer_used: 0, total_used: 0 },
    now: '2026-07-18T10:00:00.000Z',
  };
}

describe('firstTimeBuyer', () => {
  it('passes when customer has zero orders', () => {
    expect(firstTimeBuyer({}, makeContext(0))).toBe(true);
  });

  it('fails when customer has one order', () => {
    expect(firstTimeBuyer({}, makeContext(1))).toBe(false);
  });

  it('fails when customer has many orders', () => {
    expect(firstTimeBuyer({}, makeContext(50))).toBe(false);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

```bash
npx jest src/modules/offers/rules/first-time-buyer.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 7: Implement firstTimeBuyer**

```typescript
// src/modules/offers/rules/first-time-buyer.ts
import type { RuleEvaluator } from './types';

/**
 * Rule evaluator: first_time_buyer
 * Checks if the customer has zero paid orders with this merchant.
 * Config is empty — this rule has no parameters.
 *
 * @param _config - Unused (rule has no parameters)
 * @param context - Evaluation context with customer data
 * @returns true if context.customer.total_orders === 0
 */
export const firstTimeBuyer: RuleEvaluator = (_config, context) => {
  return context.customer.total_orders === 0;
};
```

- [ ] **Step 8: Run test to verify it passes**

```bash
npx jest src/modules/offers/rules/first-time-buyer.test.ts
```

Expected: PASS — all 3 tests pass.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(rules): add customer_segment and first_time_buyer evaluators"
```

---

## Task 8: Rule Evaluators — Usage Limit Rules (per_customer_limit, total_usage_limit)

**Files:**
- Create: `src/modules/offers/rules/per-customer-limit.ts`
- Create: `src/modules/offers/rules/total-usage-limit.ts`
- Test: `src/modules/offers/rules/per-customer-limit.test.ts`
- Test: `src/modules/offers/rules/total-usage-limit.test.ts`

- [ ] **Step 1: Write failing test for per_customer_limit**

```typescript
// src/modules/offers/rules/per-customer-limit.test.ts
import { perCustomerLimit } from './per-customer-limit';
import type { EvaluationContext } from '../schemas/evaluation';

function makeContext(perCustomerUsed: number): EvaluationContext {
  return {
    cart: { amount: 1000, items: [] },
    customer: {
      customer_id: 'c1', segments: [], total_orders: 0, per_customer_used: perCustomerUsed,
    },
    merchant: {
      stacking_policy: {
        max_coupons: 1, max_auto_offers: 1,
        max_total_discount: null, allow_cross_type: true, exclusive_tags: [],
      },
    },
    usage: { per_customer_used: perCustomerUsed, total_used: 0 },
    now: '2026-07-18T10:00:00.000Z',
  };
}

describe('perCustomerLimit', () => {
  it('passes when usage is below limit', () => {
    expect(perCustomerLimit({ limit: 2 }, makeContext(1))).toBe(true);
  });

  it('fails when usage equals limit', () => {
    expect(perCustomerLimit({ limit: 2 }, makeContext(2))).toBe(false);
  });

  it('fails when usage exceeds limit', () => {
    expect(perCustomerLimit({ limit: 2 }, makeContext(3))).toBe(false);
  });

  it('passes when usage is 0 and limit is 1', () => {
    expect(perCustomerLimit({ limit: 1 }, makeContext(0))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/modules/offers/rules/per-customer-limit.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement perCustomerLimit**

```typescript
// src/modules/offers/rules/per-customer-limit.ts
import type { RuleEvaluator } from './types';

/**
 * Rule evaluator: per_customer_limit
 * Checks if the customer has used this offer fewer times than the limit.
 * Uses context.usage.per_customer_used (resolved before evaluation).
 *
 * @param config - Must contain { limit: number }
 * @param context - Evaluation context with usage data
 * @returns true if context.usage.per_customer_used < config.limit
 */
export const perCustomerLimit: RuleEvaluator = (config, context) => {
  const limit = (config as { limit: number }).limit;
  return context.usage.per_customer_used < limit;
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest src/modules/offers/rules/per-customer-limit.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write failing test for total_usage_limit**

```typescript
// src/modules/offers/rules/total-usage-limit.test.ts
import { totalUsageLimit } from './total-usage-limit';
import type { EvaluationContext } from '../schemas/evaluation';

function makeContext(totalUsed: number): EvaluationContext {
  return {
    cart: { amount: 1000, items: [] },
    customer: { customer_id: 'c1', segments: [], total_orders: 0, per_customer_used: 0 },
    merchant: {
      stacking_policy: {
        max_coupons: 1, max_auto_offers: 1,
        max_total_discount: null, allow_cross_type: true, exclusive_tags: [],
      },
    },
    usage: { per_customer_used: 0, total_used: totalUsed },
    now: '2026-07-18T10:00:00.000Z',
  };
}

describe('totalUsageLimit', () => {
  it('passes when total usage is below limit', () => {
    expect(totalUsageLimit({ limit: 1000 }, makeContext(999))).toBe(true);
  });

  it('fails when total usage equals limit', () => {
    expect(totalUsageLimit({ limit: 1000 }, makeContext(1000))).toBe(false);
  });

  it('passes when total usage is zero', () => {
    expect(totalUsageLimit({ limit: 100 }, makeContext(0))).toBe(true);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

```bash
npx jest src/modules/offers/rules/total-usage-limit.test.ts
```

Expected: FAIL.

- [ ] **Step 7: Implement totalUsageLimit**

```typescript
// src/modules/offers/rules/total-usage-limit.ts
import type { RuleEvaluator } from './types';

/**
 * Rule evaluator: total_usage_limit
 * Checks if the offer has been used fewer times than the total limit.
 * Uses context.usage.total_used (resolved before evaluation).
 *
 * @param config - Must contain { limit: number }
 * @param context - Evaluation context with usage data
 * @returns true if context.usage.total_used < config.limit
 */
export const totalUsageLimit: RuleEvaluator = (config, context) => {
  const limit = (config as { limit: number }).limit;
  return context.usage.total_used < limit;
};
```

- [ ] **Step 8: Run test to verify it passes**

```bash
npx jest src/modules/offers/rules/total-usage-limit.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(rules): add per_customer_limit and total_usage_limit evaluators"
```

---

## Task 9: Rule Evaluators — Product/Category/Brand Rules

**Files:**
- Create: `src/modules/offers/rules/category-restriction.ts`
- Create: `src/modules/offers/rules/product-restriction.ts`
- Create: `src/modules/offers/rules/brand-restriction.ts`
- Create: `src/modules/offers/rules/product-combo.ts`
- Test: `src/modules/offers/rules/category-restriction.test.ts`
- Test: `src/modules/offers/rules/product-restriction.test.ts`
- Test: `src/modules/offers/rules/brand-restriction.test.ts`
- Test: `src/modules/offers/rules/product-combo.test.ts`

- [ ] **Step 1: Write failing test for category_restriction**

```typescript
// src/modules/offers/rules/category-restriction.test.ts
import { categoryRestriction } from './category-restriction';
import type { EvaluationContext } from '../schemas/evaluation';

function makeContext(items: { sku_id: string; category?: string; price: number; qty: number }[]): EvaluationContext {
  return {
    cart: {
      amount: items.reduce((sum, i) => sum + i.price * i.qty, 0),
      items: items as never,
    },
    customer: { customer_id: 'c1', segments: [], total_orders: 0, per_customer_used: 0 },
    merchant: {
      stacking_policy: {
        max_coupons: 1, max_auto_offers: 1,
        max_total_discount: null, allow_cross_type: true, exclusive_tags: [],
      },
    },
    usage: { per_customer_used: 0, total_used: 0 },
    now: '2026-07-18T10:00:00.000Z',
  };
}

describe('categoryRestriction', () => {
  it('passes (inclusive) when cart contains an item in target category', () => {
    const ctx = makeContext([{ sku_id: 'SKU-1', category: 'electronics', price: 5000, qty: 1 }]);
    expect(categoryRestriction({ categories: ['electronics'], exclude: false }, ctx)).toBe(true);
  });

  it('fails (inclusive) when cart has no item in target category', () => {
    const ctx = makeContext([{ sku_id: 'SKU-1', category: 'clothing', price: 1000, qty: 1 }]);
    expect(categoryRestriction({ categories: ['electronics'], exclude: false }, ctx)).toBe(false);
  });

  it('passes (exclusive) when cart does NOT contain target category', () => {
    const ctx = makeContext([{ sku_id: 'SKU-1', category: 'clothing', price: 1000, qty: 1 }]);
    expect(categoryRestriction({ categories: ['electronics'], exclude: true }, ctx)).toBe(true);
  });

  it('fails (exclusive) when cart contains target category', () => {
    const ctx = makeContext([{ sku_id: 'SKU-1', category: 'electronics', price: 5000, qty: 1 }]);
    expect(categoryRestriction({ categories: ['electronics'], exclude: true }, ctx)).toBe(false);
  });

  it('passes when item has no category and rule is inclusive with other categories', () => {
    const ctx = makeContext([{ sku_id: 'SKU-1', price: 1000, qty: 1 }]);
    expect(categoryRestriction({ categories: ['electronics'], exclude: false }, ctx)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/modules/offers/rules/category-restriction.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement categoryRestriction**

```typescript
// src/modules/offers/rules/category-restriction.ts
import type { RuleEvaluator } from './types';

/**
 * Rule evaluator: category_restriction
 * Checks if the cart contains items in specified categories.
 * - exclude=false (inclusive): cart must contain at least one item in target categories
 * - exclude=true (exclusive): cart must NOT contain any item in target categories
 *
 * @param config - { categories: string[], exclude: boolean }
 * @param context - Evaluation context with cart items
 * @returns true if the category condition is satisfied
 */
export const categoryRestriction: RuleEvaluator = (config, context) => {
  const { categories, exclude } = config as { categories: string[]; exclude: boolean };
  const hasMatchingCategory = context.cart.items.some(
    (item) => item.category !== undefined && categories.includes(item.category),
  );
  return exclude ? !hasMatchingCategory : hasMatchingCategory;
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest src/modules/offers/rules/category-restriction.test.ts
```

Expected: PASS — all 5 tests.

- [ ] **Step 5: Write failing test for product_restriction**

```typescript
// src/modules/offers/rules/product-restriction.test.ts
import { productRestriction } from './product-restriction';
import type { EvaluationContext } from '../schemas/evaluation';

function makeContext(skus: string[]): EvaluationContext {
  return {
    cart: {
      amount: 1000 * skus.length,
      items: skus.map((s) => ({ sku_id: s, price: 1000, qty: 1 })) as never,
    },
    customer: { customer_id: 'c1', segments: [], total_orders: 0, per_customer_used: 0 },
    merchant: {
      stacking_policy: {
        max_coupons: 1, max_auto_offers: 1,
        max_total_discount: null, allow_cross_type: true, exclusive_tags: [],
      },
    },
    usage: { per_customer_used: 0, total_used: 0 },
    now: '2026-07-18T10:00:00.000Z',
  };
}

describe('productRestriction', () => {
  it('passes (inclusive) when cart contains target SKU', () => {
    expect(productRestriction({ skus: ['SKU-1'], exclude: false }, makeContext(['SKU-1', 'SKU-2']))).toBe(true);
  });

  it('fails (inclusive) when cart does not contain target SKU', () => {
    expect(productRestriction({ skus: ['SKU-9'], exclude: false }, makeContext(['SKU-1']))).toBe(false);
  });

  it('passes (exclusive) when cart does NOT contain target SKU', () => {
    expect(productRestriction({ skus: ['SKU-9'], exclude: true }, makeContext(['SKU-1']))).toBe(true);
  });

  it('fails (exclusive) when cart contains target SKU', () => {
    expect(productRestriction({ skus: ['SKU-1'], exclude: true }, makeContext(['SKU-1']))).toBe(false);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

```bash
npx jest src/modules/offers/rules/product-restriction.test.ts
```

Expected: FAIL.

- [ ] **Step 7: Implement productRestriction**

```typescript
// src/modules/offers/rules/product-restriction.ts
import type { RuleEvaluator } from './types';

/**
 * Rule evaluator: product_restriction
 * Checks if the cart contains specific SKUs.
 * - exclude=false (inclusive): cart must contain at least one target SKU
 * - exclude=true (exclusive): cart must NOT contain any target SKU
 *
 * @param config - { skus: string[], exclude: boolean }
 * @param context - Evaluation context with cart items
 * @returns true if the product condition is satisfied
 */
export const productRestriction: RuleEvaluator = (config, context) => {
  const { skus, exclude } = config as { skus: string[]; exclude: boolean };
  const hasMatchingSku = context.cart.items.some((item) => skus.includes(item.sku_id));
  return exclude ? !hasMatchingSku : hasMatchingSku;
};
```

- [ ] **Step 8: Run test to verify it passes**

```bash
npx jest src/modules/offers/rules/product-restriction.test.ts
```

Expected: PASS — all 4 tests.

- [ ] **Step 9: Write failing test for brand_restriction**

```typescript
// src/modules/offers/rules/brand-restriction.test.ts
import { brandRestriction } from './brand-restriction';
import type { EvaluationContext } from '../schemas/evaluation';

function makeContext(items: { sku_id: string; brand?: string; price: number; qty: number }[]): EvaluationContext {
  return {
    cart: {
      amount: items.reduce((s, i) => s + i.price * i.qty, 0),
      items: items as never,
    },
    customer: { customer_id: 'c1', segments: [], total_orders: 0, per_customer_used: 0 },
    merchant: {
      stacking_policy: {
        max_coupons: 1, max_auto_offers: 1,
        max_total_discount: null, allow_cross_type: true, exclusive_tags: [],
      },
    },
    usage: { per_customer_used: 0, total_used: 0 },
    now: '2026-07-18T10:00:00.000Z',
  };
}

describe('brandRestriction', () => {
  it('passes (inclusive) when cart has Apple brand item', () => {
    const ctx = makeContext([{ sku_id: 'SKU-1', brand: 'Apple', price: 50000, qty: 1 }]);
    expect(brandRestriction({ brands: ['Apple'], exclude: false }, ctx)).toBe(true);
  });

  it('fails (inclusive) when cart has no Apple item', () => {
    const ctx = makeContext([{ sku_id: 'SKU-1', brand: 'Samsung', price: 30000, qty: 1 }]);
    expect(brandRestriction({ brands: ['Apple'], exclude: false }, ctx)).toBe(false);
  });

  it('passes (exclusive) when cart has no Apple item', () => {
    const ctx = makeContext([{ sku_id: 'SKU-1', brand: 'Samsung', price: 30000, qty: 1 }]);
    expect(brandRestriction({ brands: ['Apple'], exclude: true }, ctx)).toBe(true);
  });

  it('fails (exclusive) when cart has Apple item', () => {
    const ctx = makeContext([{ sku_id: 'SKU-1', brand: 'Apple', price: 50000, qty: 1 }]);
    expect(brandRestriction({ brands: ['Apple'], exclude: true }, ctx)).toBe(false);
  });
});
```

- [ ] **Step 10: Run test to verify it fails**

```bash
npx jest src/modules/offers/rules/brand-restriction.test.ts
```

Expected: FAIL.

- [ ] **Step 11: Implement brandRestriction**

```typescript
// src/modules/offers/rules/brand-restriction.ts
import type { RuleEvaluator } from './types';

/**
 * Rule evaluator: brand_restriction
 * Checks if the cart contains items from specified brands.
 * - exclude=false (inclusive): cart must contain at least one item of target brands
 * - exclude=true (exclusive): cart must NOT contain any item of target brands
 * Ready for future brand-offer module (BrandOfferEvaluator).
 *
 * @param config - { brands: string[], exclude: boolean }
 * @param context - Evaluation context with cart items
 * @returns true if the brand condition is satisfied
 */
export const brandRestriction: RuleEvaluator = (config, context) => {
  const { brands, exclude } = config as { brands: string[]; exclude: boolean };
  const hasMatchingBrand = context.cart.items.some(
    (item) => item.brand !== undefined && brands.includes(item.brand),
  );
  return exclude ? !hasMatchingBrand : hasMatchingBrand;
};
```

- [ ] **Step 12: Run test to verify it passes**

```bash
npx jest src/modules/offers/rules/brand-restriction.test.ts
```

Expected: PASS — all 4 tests.

- [ ] **Step 13: Write failing test for product_combo**

```typescript
// src/modules/offers/rules/product-combo.test.ts
import { productCombo } from './product-combo';
import type { EvaluationContext } from '../schemas/evaluation';

function makeContext(skus: string[]): EvaluationContext {
  return {
    cart: {
      amount: 1000 * skus.length,
      items: skus.map((s) => ({ sku_id: s, price: 1000, qty: 1 })) as never,
    },
    customer: { customer_id: 'c1', segments: [], total_orders: 0, per_customer_used: 0 },
    merchant: {
      stacking_policy: {
        max_coupons: 1, max_auto_offers: 1,
        max_total_discount: null, allow_cross_type: true, exclusive_tags: [],
      },
    },
    usage: { per_customer_used: 0, total_used: 0 },
    now: '2026-07-18T10:00:00.000Z',
  };
}

describe('productCombo', () => {
  it('passes when all required SKUs are in cart', () => {
    expect(productCombo({ skus: ['SKU-1', 'SKU-2'] }, makeContext(['SKU-1', 'SKU-2', 'SKU-3']))).toBe(true);
  });

  it('fails when one required SKU is missing', () => {
    expect(productCombo({ skus: ['SKU-1', 'SKU-2'] }, makeContext(['SKU-1', 'SKU-3']))).toBe(false);
  });

  it('fails when no required SKUs are in cart', () => {
    expect(productCombo({ skus: ['SKU-1', 'SKU-2'] }, makeContext(['SKU-3']))).toBe(false);
  });

  it('passes with single SKU combo when present', () => {
    expect(productCombo({ skus: ['SKU-1'] }, makeContext(['SKU-1']))).toBe(true);
  });
});
```

- [ ] **Step 14: Run test to verify it fails**

```bash
npx jest src/modules/offers/rules/product-combo.test.ts
```

Expected: FAIL.

- [ ] **Step 15: Implement productCombo**

```typescript
// src/modules/offers/rules/product-combo.ts
import type { RuleEvaluator } from './types';

/**
 * Rule evaluator: product_combo
 * Checks if ALL required SKUs are present in the cart (bundle requirement).
 * The customer must buy every item in the combo to be eligible.
 *
 * @param config - { skus: string[] } — all SKUs that must be in cart
 * @param context - Evaluation context with cart items
 * @returns true if every required SKU is in the cart
 */
export const productCombo: RuleEvaluator = (config, context) => {
  const requiredSkus = (config as { skus: string[] }).skus;
  const cartSkus = context.cart.items.map((item) => item.sku_id);
  return requiredSkus.every((sku) => cartSkus.includes(sku));
};
```

- [ ] **Step 16: Run test to verify it passes**

```bash
npx jest src/modules/offers/rules/product-combo.test.ts
```

Expected: PASS — all 4 tests.

- [ ] **Step 17: Commit**

```bash
git add -A
git commit -m "feat(rules): add category, product, brand restriction and product_combo evaluators"
```

---

## Task 10: Rule Evaluators — Time/Window Rules (time_window, weekend_only, date_range)

**Files:**
- Create: `src/modules/offers/rules/time-window.ts`
- Create: `src/modules/offers/rules/weekend-only.ts`
- Create: `src/modules/offers/rules/date-range.ts`
- Test: `src/modules/offers/rules/time-window.test.ts`
- Test: `src/modules/offers/rules/weekend-only.test.ts`
- Test: `src/modules/offers/rules/date-range.test.ts`

- [ ] **Step 1: Write failing test for time_window**

```typescript
// src/modules/offers/rules/time-window.test.ts
import { timeWindow } from './time-window';
import type { EvaluationContext } from '../schemas/evaluation';

function makeContext(isoTime: string): EvaluationContext {
  return {
    cart: { amount: 1000, items: [] },
    customer: { customer_id: 'c1', segments: [], total_orders: 0, per_customer_used: 0 },
    merchant: {
      stacking_policy: {
        max_coupons: 1, max_auto_offers: 1,
        max_total_discount: null, allow_cross_type: true, exclusive_tags: [],
      },
    },
    usage: { per_customer_used: 0, total_used: 0 },
    now: isoTime,
  };
}

describe('timeWindow', () => {
  it('passes when current day is in allowed days and hour is in range', () => {
    // 2026-07-18 is a Saturday
    expect(timeWindow(
      { days: ['sat', 'sun'], start_hour: 0, end_hour: 23 },
      makeContext('2026-07-18T14:00:00.000Z'),
    )).toBe(true);
  });

  it('fails when current day is not in allowed days', () => {
    // 2026-07-20 is a Monday
    expect(timeWindow(
      { days: ['sat', 'sun'], start_hour: 0, end_hour: 23 },
      makeContext('2026-07-20T14:00:00.000Z'),
    )).toBe(false);
  });

  it('fails when hour is before start_hour', () => {
    expect(timeWindow(
      { days: ['sat'], start_hour: 10, end_hour: 20 },
      makeContext('2026-07-18T09:00:00.000Z'),
    )).toBe(false);
  });

  it('fails when hour is after end_hour', () => {
    expect(timeWindow(
      { days: ['sat'], start_hour: 10, end_hour: 20 },
      makeContext('2026-07-18T21:00:00.000Z'),
    )).toBe(false);
  });

  it('passes at boundary hour (start_hour)', () => {
    expect(timeWindow(
      { days: ['sat'], start_hour: 10, end_hour: 20 },
      makeContext('2026-07-18T10:00:00.000Z'),
    )).toBe(true);
  });

  it('passes at boundary hour (end_hour)', () => {
    expect(timeWindow(
      { days: ['sat'], start_hour: 10, end_hour: 20 },
      makeContext('2026-07-18T20:00:00.000Z'),
    )).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/modules/offers/rules/time-window.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement timeWindow**

```typescript
// src/modules/offers/rules/time-window.ts
import type { RuleEvaluator } from './types';

const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

/**
 * Rule evaluator: time_window
 * Checks if the current time falls within specified days of the week and hour range.
 * Note: day and hour are derived from the `now` timestamp in context (UTC).
 *
 * @param config - { days: string[], start_hour: number, end_hour: number }
 *   days: lowercase day names ('sun', 'mon', etc.)
 *   start_hour/end_hour: 0-23 inclusive
 * @param context - Evaluation context with `now` timestamp
 * @returns true if current day is in days[] and start_hour <= hour <= end_hour
 */
export const timeWindow: RuleEvaluator = (config, context) => {
  const { days, start_hour, end_hour } = config as {
    days: string[];
    start_hour: number;
    end_hour: number;
  };
  const now = new Date(context.now);
  const dayName = DAY_NAMES[now.getUTCDay()];
  const hour = now.getUTCHours();
  return days.includes(dayName) && hour >= start_hour && hour <= end_hour;
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest src/modules/offers/rules/time-window.test.ts
```

Expected: PASS — all 6 tests.

- [ ] **Step 5: Write failing test for weekend_only**

```typescript
// src/modules/offers/rules/weekend-only.test.ts
import { weekendOnly } from './weekend-only';
import type { EvaluationContext } from '../schemas/evaluation';

function makeContext(isoTime: string): EvaluationContext {
  return {
    cart: { amount: 1000, items: [] },
    customer: { customer_id: 'c1', segments: [], total_orders: 0, per_customer_used: 0 },
    merchant: {
      stacking_policy: {
        max_coupons: 1, max_auto_offers: 1,
        max_total_discount: null, allow_cross_type: true, exclusive_tags: [],
      },
    },
    usage: { per_customer_used: 0, total_used: 0 },
    now: isoTime,
  };
}

describe('weekendOnly', () => {
  it('passes on Saturday', () => {
    // 2026-07-18 is Saturday
    expect(weekendOnly({}, makeContext('2026-07-18T12:00:00.000Z'))).toBe(true);
  });

  it('passes on Sunday', () => {
    // 2026-07-19 is Sunday
    expect(weekendOnly({}, makeContext('2026-07-19T12:00:00.000Z'))).toBe(true);
  });

  it('fails on Monday', () => {
    // 2026-07-20 is Monday
    expect(weekendOnly({}, makeContext('2026-07-20T12:00:00.000Z'))).toBe(false);
  });

  it('fails on Friday', () => {
    // 2026-07-17 is Friday
    expect(weekendOnly({}, makeContext('2026-07-17T12:00:00.000Z'))).toBe(false);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

```bash
npx jest src/modules/offers/rules/weekend-only.test.ts
```

Expected: FAIL.

- [ ] **Step 7: Implement weekendOnly**

```typescript
// src/modules/offers/rules/weekend-only.ts
import type { RuleEvaluator } from './types';

/**
 * Rule evaluator: weekend_only
 * Checks if the current time falls on a weekend (Saturday or Sunday).
 * Config is empty — this rule has no parameters.
 *
 * @param _config - Unused (rule has no parameters)
 * @param context - Evaluation context with `now` timestamp
 * @returns true if current day is Saturday (6) or Sunday (0)
 */
export const weekendOnly: RuleEvaluator = (_config, context) => {
  const day = new Date(context.now).getUTCDay();
  return day === 0 || day === 6;
};
```

- [ ] **Step 8: Run test to verify it passes**

```bash
npx jest src/modules/offers/rules/weekend-only.test.ts
```

Expected: PASS — all 4 tests.

- [ ] **Step 9: Write failing test for date_range**

```typescript
// src/modules/offers/rules/date-range.test.ts
import { dateRange } from './date-range';
import type { EvaluationContext } from '../schemas/evaluation';

function makeContext(isoTime: string): EvaluationContext {
  return {
    cart: { amount: 1000, items: [] },
    customer: { customer_id: 'c1', segments: [], total_orders: 0, per_customer_used: 0 },
    merchant: {
      stacking_policy: {
        max_coupons: 1, max_auto_offers: 1,
        max_total_discount: null, allow_cross_type: true, exclusive_tags: [],
      },
    },
    usage: { per_customer_used: 0, total_used: 0 },
    now: isoTime,
  };
}

describe('dateRange', () => {
  it('passes when current date is within range', () => {
    expect(dateRange(
      { start_date: '2026-07-01', end_date: '2026-07-31' },
      makeContext('2026-07-18T12:00:00.000Z'),
    )).toBe(true);
  });

  it('passes at start boundary', () => {
    expect(dateRange(
      { start_date: '2026-07-01', end_date: '2026-07-31' },
      makeContext('2026-07-01T00:00:00.000Z'),
    )).toBe(true);
  });

  it('passes at end boundary', () => {
    expect(dateRange(
      { start_date: '2026-07-01', end_date: '2026-07-31' },
      makeContext('2026-07-31T23:59:59.000Z'),
    )).toBe(true);
  });

  it('fails before start date', () => {
    expect(dateRange(
      { start_date: '2026-07-01', end_date: '2026-07-31' },
      makeContext('2026-06-30T23:59:59.000Z'),
    )).toBe(false);
  });

  it('fails after end date', () => {
    expect(dateRange(
      { start_date: '2026-07-01', end_date: '2026-07-31' },
      makeContext('2026-08-01T00:00:00.000Z'),
    )).toBe(false);
  });
});
```

- [ ] **Step 10: Run test to verify it fails**

```bash
npx jest src/modules/offers/rules/date-range.test.ts
```

Expected: FAIL.

- [ ] **Step 11: Implement dateRange**

```typescript
// src/modules/offers/rules/date-range.ts
import type { RuleEvaluator } from './types';

/**
 * Rule evaluator: date_range
 * Checks if the current time falls within a start and end date (inclusive).
 * Dates are compared as timestamps — start at 00:00:00, end at 23:59:59 of the end date.
 *
 * @param config - { start_date: string (YYYY-MM-DD), end_date: string (YYYY-MM-DD) }
 * @param context - Evaluation context with `now` timestamp
 * @returns true if start_date <= now <= end_date (end date at 23:59:59)
 */
export const dateRange: RuleEvaluator = (config, context) => {
  const { start_date, end_date } = config as { start_date: string; end_date: string };
  const now = new Date(context.now);
  const start = new Date(`${start_date}T00:00:00.000Z`);
  const end = new Date(`${end_date}T23:59:59.999Z`);
  return now >= start && now <= end;
};
```

- [ ] **Step 12: Run test to verify it passes**

```bash
npx jest src/modules/offers/rules/date-range.test.ts
```

Expected: PASS — all 5 tests.

- [ ] **Step 13: Run all tests, lint, typecheck**

```bash
npx jest
npm run lint
npm run typecheck
```

Expected: All pass.

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "feat(rules): add time_window, weekend_only, and date_range evaluators"
```

---

## Task 11: Offer Evaluator Interface & Registry

**Files:**
- Create: `src/modules/offers/evaluators/types.ts`
- Create: `src/modules/offers/evaluators/index.ts`
- Test: `src/modules/offers/evaluators/index.test.ts`

- [ ] **Step 1: Write failing test for OfferEvaluatorRegistry**

```typescript
// src/modules/offers/evaluators/index.test.ts
import { OfferEvaluatorRegistry } from './index';
import type { OfferEvaluator } from './types';
import type { Offer } from '../schemas/offer';
import type { EvaluationContext } from '../schemas/evaluation';
import type { EvaluationResult } from '../schemas/evaluation';

const mockOffer: Offer = {
  _id: 'offer_1',
  merchant_id: 'merch_1',
  code: 'FLAT50',
  type: 'coupon',
  title: 'Flat 50 off',
  discount: { type: 'flat', value: 50, max_discount: null },
  subsidy_model: 'merchant',
  status: 'active',
  validity: { starts_at: '2026-01-01T00:00:00.000Z', ends_at: '2026-12-31T23:59:59.000Z' },
  usage_limits: { total: null, per_customer: null },
  usage_count: 0,
  rules: [],
  stacking: { stacks_with: null, exclusive: false, priority: 0 },
  tags: [],
  created_at: '2026-07-18T09:00:00.000Z',
  updated_at: '2026-07-18T09:00:00.000Z',
};

const mockContext: EvaluationContext = {
  cart: { amount: 5000, items: [{ sku_id: 'SKU-1', price: 5000, qty: 1 }] },
  customer: { customer_id: 'c1', segments: [], total_orders: 0, per_customer_used: 0 },
  merchant: {
    stacking_policy: {
      max_coupons: 1, max_auto_offers: 1,
      max_total_discount: null, allow_cross_type: true, exclusive_tags: [],
    },
  },
  usage: { per_customer_used: 0, total_used: 0 },
  now: '2026-07-18T10:00:00.000Z',
};

const mockEvaluator: OfferEvaluator = {
  evaluate: (_offer: Offer, _context: EvaluationContext): EvaluationResult => ({
    eligible: true,
    matched_rules: [],
    failed_rule: null,
    reason: null,
    discount: { type: 'flat', value: 50, max_discount: null, amount: 50 },
  }),
};

describe('OfferEvaluatorRegistry', () => {
  it('registers and calls an evaluator by offer type', () => {
    const registry = new OfferEvaluatorRegistry();
    registry.register('coupon', mockEvaluator);

    const result = registry.evaluate(mockOffer, mockContext);
    expect(result.eligible).toBe(true);
    expect(result.discount?.amount).toBe(50);
  });

  it('throws when evaluating unregistered offer type', () => {
    const registry = new OfferEvaluatorRegistry();
    expect(() => registry.evaluate(mockOffer, mockContext)).toThrow(/coupon/);
  });

  it('checks if an offer type is registered', () => {
    const registry = new OfferEvaluatorRegistry();
    registry.register('coupon', mockEvaluator);
    expect(registry.has('coupon')).toBe(true);
    expect(registry.has('auto_offer')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/modules/offers/evaluators/index.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement OfferEvaluator interface**

```typescript
// src/modules/offers/evaluators/types.ts
import type { Offer } from '../schemas/offer';
import type { EvaluationContext, EvaluationResult } from '../schemas/evaluation';

/**
 * Interface for offer type evaluators.
 * Each offer type (coupon, auto_offer, bank_offer, etc.) implements this interface.
 * The registry routes offers to the appropriate evaluator based on offer.type.
 *
 * When extracting to microservices, a remote adapter can implement this interface
 * to proxy evaluation calls over HTTP — consuming code stays unchanged.
 */
export interface OfferEvaluator {
  /**
   * Evaluates an offer against the given context.
   * Checks status, validity, usage limits, and all rules.
   *
   * @param offer - The offer to evaluate
   * @param context - Cart, customer, merchant, and usage data
   * @returns Evaluation result with eligibility, discount, and failure reason
   */
  evaluate(offer: Offer, context: EvaluationContext): EvaluationResult;
}
```

- [ ] **Step 4: Implement OfferEvaluatorRegistry**

```typescript
// src/modules/offers/evaluators/index.ts
import type { Offer } from '../schemas/offer';
import type { EvaluationContext, EvaluationResult } from '../schemas/evaluation';
import type { OfferEvaluator } from './types';

/**
 * Registry that maps offer types to their evaluator implementations.
 * New offer types (bank_offer, brand_offer, etc.) are added by calling
 * register() — no modifications to existing evaluators or this registry.
 * This is the Open/Closed principle in action.
 */
export class OfferEvaluatorRegistry {
  private evaluators = new Map<string, OfferEvaluator>();

  /**
   * Registers an evaluator for an offer type.
   * @param offerType - The offer type string (e.g., "coupon", "auto_offer")
   * @param evaluator - Evaluator implementing the OfferEvaluator interface
   */
  register(offerType: string, evaluator: OfferEvaluator): void {
    this.evaluators.set(offerType, evaluator);
  }

  /**
   * Checks if an evaluator is registered for the given offer type.
   * @param offerType - The offer type string
   * @returns true if an evaluator is registered
   */
  has(offerType: string): boolean {
    return this.evaluators.has(offerType);
  }

  /**
   * Evaluates an offer using the registered evaluator for its type.
   * @param offer - The offer to evaluate (type field determines which evaluator)
   * @param context - Evaluation context
   * @returns Evaluation result
   * @throws Error if no evaluator is registered for offer.type
   */
  evaluate(offer: Offer, context: EvaluationContext): EvaluationResult {
    const evaluator = this.evaluators.get(offer.type);
    if (!evaluator) {
      throw new Error(`No evaluator registered for offer type: ${offer.type}`);
    }
    return evaluator.evaluate(offer, context);
  }

  /**
   * Evaluates multiple offers and returns only the eligible ones.
   * @param offers - Array of offers to evaluate
   * @param context - Evaluation context
   * @returns Array of { offer, result } for eligible offers
   */
  evaluateEligible(
    offers: Offer[],
    context: EvaluationContext,
  ): Array<{ offer: Offer; result: EvaluationResult }> {
    return offers
      .map((offer) => ({ offer, result: this.evaluate(offer, context) }))
      .filter(({ result }) => result.eligible);
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx jest src/modules/offers/evaluators/index.test.ts
```

Expected: PASS — all 3 tests.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(evaluators): add OfferEvaluator interface and OfferEvaluatorRegistry"
```

---

## Task 12: CouponEvaluator

**Files:**
- Create: `src/modules/offers/evaluators/coupon-evaluator.ts`
- Test: `src/modules/offers/evaluators/coupon-evaluator.test.ts`

- [ ] **Step 1: Write failing test for CouponEvaluator**

```typescript
// src/modules/offers/evaluators/coupon-evaluator.test.ts
import { CouponEvaluator } from './coupon-evaluator';
import { RuleEvaluatorRegistry } from '../rules';
import { minCartValue } from '../rules/min-cart-value';
import type { Offer } from '../schemas/offer';
import type { EvaluationContext } from '../schemas/evaluation';

function makeOffer(overrides: Partial<Offer> = {}): Offer {
  return {
    _id: 'offer_1',
    merchant_id: 'merch_1',
    code: 'FLAT50',
    type: 'coupon',
    title: 'Flat 50 off',
    discount: { type: 'flat', value: 50, max_discount: null },
    subsidy_model: 'merchant',
    status: 'active',
    validity: { starts_at: '2026-01-01T00:00:00.000Z', ends_at: '2026-12-31T23:59:59.000Z' },
    usage_limits: { total: null, per_customer: null },
    usage_count: 0,
    rules: [],
    stacking: { stacks_with: null, exclusive: false, priority: 0 },
    tags: [],
    created_at: '2026-07-18T09:00:00.000Z',
    updated_at: '2026-07-18T09:00:00.000Z',
    ...overrides,
  };
}

function makeContext(overrides: Partial<EvaluationContext> = {}): EvaluationContext {
  return {
    cart: { amount: 5000, items: [{ sku_id: 'SKU-1', price: 5000, qty: 1 }] },
    customer: { customer_id: 'c1', segments: [], total_orders: 0, per_customer_used: 0 },
    merchant: {
      stacking_policy: {
        max_coupons: 1, max_auto_offers: 1,
        max_total_discount: null, allow_cross_type: true, exclusive_tags: [],
      },
    },
    usage: { per_customer_used: 0, total_used: 0 },
    now: '2026-07-18T10:00:00.000Z',
    ...overrides,
  };
}

function makeEvaluatorWithRules(): CouponEvaluator {
  const ruleRegistry = new RuleEvaluatorRegistry();
  ruleRegistry.register('min_cart_value', minCartValue);
  return new CouponEvaluator(ruleRegistry);
}

describe('CouponEvaluator', () => {
  it('returns eligible with discount when all checks pass', () => {
    const evaluator = makeEvaluatorWithRules();
    const offer = makeOffer();
    const result = evaluator.evaluate(offer, makeContext());

    expect(result.eligible).toBe(true);
    expect(result.discount?.amount).toBe(50);
    expect(result.failed_rule).toBeNull();
    expect(result.reason).toBeNull();
  });

  it('returns ineligible when status is inactive', () => {
    const evaluator = makeEvaluatorWithRules();
    const offer = makeOffer({ status: 'inactive' });
    const result = evaluator.evaluate(offer, makeContext());

    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('inactive');
  });

  it('returns ineligible when status is expired', () => {
    const evaluator = makeEvaluatorWithRules();
    const offer = makeOffer({ status: 'expired' });
    const result = evaluator.evaluate(offer, makeContext());

    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('expired');
  });

  it('returns ineligible when now is before validity starts_at', () => {
    const evaluator = makeEvaluatorWithRules();
    const offer = makeOffer({
      validity: { starts_at: '2026-12-01T00:00:00.000Z', ends_at: '2026-12-31T23:59:59.000Z' },
    });
    const result = evaluator.evaluate(offer, makeContext({ now: '2026-07-18T10:00:00.000Z' }));

    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('not yet valid');
  });

  it('returns ineligible when now is after validity ends_at', () => {
    const evaluator = makeEvaluatorWithRules();
    const offer = makeOffer({
      validity: { starts_at: '2026-01-01T00:00:00.000Z', ends_at: '2026-06-30T23:59:59.000Z' },
    });
    const result = evaluator.evaluate(offer, makeContext({ now: '2026-07-18T10:00:00.000Z' }));

    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('expired');
  });

  it('returns ineligible when total usage limit is reached', () => {
    const evaluator = makeEvaluatorWithRules();
    const offer = makeOffer({ usage_limits: { total: 100, per_customer: null }, usage_count: 100 });
    const result = evaluator.evaluate(offer, makeContext());

    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('usage limit');
  });

  it('returns ineligible when a rule fails', () => {
    const evaluator = makeEvaluatorWithRules();
    const offer = makeOffer({
      rules: [{ rule_type: 'min_cart_value', config: { min_amount: 10000 } }],
    });
    const result = evaluator.evaluate(offer, makeContext({ cart: { amount: 5000, items: [] } }));

    expect(result.eligible).toBe(false);
    expect(result.failed_rule).toBe('min_cart_value');
    expect(result.reason).toContain('min_cart_value');
  });

  it('computes percentage discount correctly', () => {
    const evaluator = makeEvaluatorWithRules();
    const offer = makeOffer({
      discount: { type: 'percentage', value: 10, max_discount: null },
    });
    const result = evaluator.evaluate(offer, makeContext({ cart: { amount: 5000, items: [] } }));

    expect(result.eligible).toBe(true);
    expect(result.discount?.amount).toBe(500);
  });

  it('computes percentage discount with max cap', () => {
    const evaluator = makeEvaluatorWithRules();
    const offer = makeOffer({
      discount: { type: 'percentage', value: 10, max_discount: 300 },
    });
    const result = evaluator.evaluate(offer, makeContext({ cart: { amount: 5000, items: [] } }));

    expect(result.eligible).toBe(true);
    expect(result.discount?.amount).toBe(300);
  });

  it('handles per_customer_limit via rule evaluator (usage context)', () => {
    const ruleRegistry = new RuleEvaluatorRegistry();
    // We test per_customer_limit as a rule on the offer
    // In practice, per_customer_limit is checked via context.usage
    // For this test, we just verify usage_limit check on the offer level
    ruleRegistry.register('min_cart_value', minCartValue);
    const evaluator = new CouponEvaluator(ruleRegistry);

    const offer = makeOffer({ usage_limits: { total: null, per_customer: 2 } });
    const result = evaluator.evaluate(offer, makeContext({
      usage: { per_customer_used: 2, total_used: 0 },
    }));

    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('per customer');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/modules/offers/evaluators/coupon-evaluator.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement CouponEvaluator**

```typescript
// src/modules/offers/evaluators/coupon-evaluator.ts
import type { Offer } from '../schemas/offer';
import type { EvaluationContext, EvaluationResult } from '../schemas/evaluation';
import type { OfferEvaluator } from './types';
import type { RuleEvaluatorRegistry } from '../rules';
import { computeDiscount } from '../schemas/discount';

/**
 * Evaluator for offer type "coupon".
 * Coupons are code-based offers that customers enter at checkout.
 * Evaluation order: status → validity window → total usage limit →
 *   per-customer limit → rules → compute discount.
 */
export class CouponEvaluator implements OfferEvaluator {
  /**
   * @param ruleRegistry - Registry of rule evaluators (injected, not imported directly)
   */
  constructor(private readonly ruleRegistry: RuleEvaluatorRegistry) {}

  evaluate(offer: Offer, context: EvaluationContext): EvaluationResult {
    // 1. Check status
    if (offer.status !== 'active') {
      return this.ineligible(`Offer is ${offer.status}`);
    }

    // 2. Check validity window
    const now = new Date(context.now);
    const startsAt = new Date(offer.validity.starts_at);
    const endsAt = new Date(offer.validity.ends_at);

    if (now < startsAt) {
      return this.ineligible('Offer is not yet valid');
    }
    if (now > endsAt) {
      return this.ineligible('Offer has expired');
    }

    // 3. Check total usage limit
    if (offer.usage_limits.total !== null && offer.usage_count >= offer.usage_limits.total) {
      return this.ineligible('Total usage limit reached');
    }

    // 4. Check per-customer usage limit
    if (
      offer.usage_limits.per_customer !== null &&
      context.usage.per_customer_used >= offer.usage_limits.per_customer
    ) {
      return this.ineligible('Per customer usage limit reached');
    }

    // 5. Evaluate all rules
    const ruleResult = this.ruleRegistry.evaluateAll(offer.rules, context);
    if (!ruleResult.passed) {
      return {
        eligible: false,
        matched_rules: [],
        failed_rule: ruleResult.failedRuleType,
        reason: `Rule failed: ${ruleResult.failedRuleType}`,
        discount: null,
      };
    }

    // 6. Compute discount
    const discountAmount = computeDiscount(offer.discount, context.cart.amount);

    return {
      eligible: true,
      matched_rules: offer.rules.map((r) => r.rule_type),
      failed_rule: null,
      reason: null,
      discount: { ...offer.discount, amount: discountAmount },
    };
  }

  private ineligible(reason: string): EvaluationResult {
    return {
      eligible: false,
      matched_rules: [],
      failed_rule: null,
      reason,
      discount: null,
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest src/modules/offers/evaluators/coupon-evaluator.test.ts
```

Expected: PASS — all 11 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(evaluators): add CouponEvaluator with status/validity/usage/rule checks"
```

---

## Task 13: AutoOfferEvaluator

**Files:**
- Create: `src/modules/offers/evaluators/auto-offer-evaluator.ts`
- Test: `src/modules/offers/evaluators/auto-offer-evaluator.test.ts`

- [ ] **Step 1: Write failing test for AutoOfferEvaluator**

```typescript
// src/modules/offers/evaluators/auto-offer-evaluator.test.ts
import { AutoOfferEvaluator } from './auto-offer-evaluator';
import { RuleEvaluatorRegistry } from '../rules';
import { minCartValue, categoryRestriction } from '../rules/min-cart-value';
import { categoryRestriction as catRest } from '../rules/category-restriction';
import type { Offer } from '../schemas/offer';
import type { EvaluationContext } from '../schemas/evaluation';

function makeOffer(overrides: Partial<Offer> = {}): Offer {
  return {
    _id: 'offer_auto_1',
    merchant_id: 'merch_1',
    code: null,
    type: 'auto_offer',
    title: '10% off electronics',
    discount: { type: 'percentage', value: 10, max_discount: null },
    subsidy_model: 'merchant',
    status: 'active',
    validity: { starts_at: '2026-01-01T00:00:00.000Z', ends_at: '2026-12-31T23:59:59.000Z' },
    usage_limits: { total: null, per_customer: null },
    usage_count: 0,
    rules: [{ rule_type: 'category_restriction', config: { categories: ['electronics'], exclude: false } }],
    stacking: { stacks_with: ['coupon'], exclusive: false, priority: 0 },
    tags: [],
    created_at: '2026-07-18T09:00:00.000Z',
    updated_at: '2026-07-18T09:00:00.000Z',
    ...overrides,
  };
}

function makeContext(overrides: Partial<EvaluationContext> = {}): EvaluationContext {
  return {
    cart: {
      amount: 5000,
      items: [{ sku_id: 'SKU-1', category: 'electronics', price: 5000, qty: 1 }],
    },
    customer: { customer_id: 'c1', segments: [], total_orders: 0, per_customer_used: 0 },
    merchant: {
      stacking_policy: {
        max_coupons: 1, max_auto_offers: 1,
        max_total_discount: null, allow_cross_type: true, exclusive_tags: [],
      },
    },
    usage: { per_customer_used: 0, total_used: 0 },
    now: '2026-07-18T10:00:00.000Z',
    ...overrides,
  };
}

function makeEvaluator(): AutoOfferEvaluator {
  const ruleRegistry = new RuleEvaluatorRegistry();
  ruleRegistry.register('min_cart_value', minCartValue);
  ruleRegistry.register('category_restriction', catRest);
  return new AutoOfferEvaluator(ruleRegistry);
}

describe('AutoOfferEvaluator', () => {
  it('returns eligible with percentage discount when rules pass', () => {
    const evaluator = makeEvaluator();
    const result = evaluator.evaluate(makeOffer(), makeContext());

    expect(result.eligible).toBe(true);
    expect(result.discount?.amount).toBe(500); // 10% of 5000
    expect(result.discount?.type).toBe('percentage');
  });

  it('returns ineligible when status is inactive', () => {
    const evaluator = makeEvaluator();
    const result = evaluator.evaluate(makeOffer({ status: 'inactive' }), makeContext());
    expect(result.eligible).toBe(false);
  });

  it('returns ineligible when category rule fails', () => {
    const evaluator = makeEvaluator();
    const ctx = makeContext({
      cart: { amount: 5000, items: [{ sku_id: 'SKU-1', category: 'clothing', price: 5000, qty: 1 }] },
    });
    const result = evaluator.evaluate(makeOffer(), ctx);
    expect(result.eligible).toBe(false);
    expect(result.failed_rule).toBe('category_restriction');
  });

  it('returns ineligible when validity has expired', () => {
    const evaluator = makeEvaluator();
    const offer = makeOffer({
      validity: { starts_at: '2026-01-01T00:00:00.000Z', ends_at: '2026-06-30T23:59:59.000Z' },
    });
    const result = evaluator.evaluate(offer, makeContext({ now: '2026-07-18T10:00:00.000Z' }));
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('expired');
  });

  it('evaluates correctly even when customer has no segments (auto-offer focuses on cart)', () => {
    const evaluator = makeEvaluator();
    const ctx = makeContext({
      customer: { customer_id: 'anon', segments: [], total_orders: 0, per_customer_used: 0 },
    });
    const result = evaluator.evaluate(makeOffer({ rules: [] }), ctx);
    expect(result.eligible).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/modules/offers/evaluators/auto-offer-evaluator.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement AutoOfferEvaluator**

```typescript
// src/modules/offers/evaluators/auto-offer-evaluator.ts
import type { Offer } from '../schemas/offer';
import type { EvaluationContext, EvaluationResult } from '../schemas/evaluation';
import type { OfferEvaluator } from './types';
import type { RuleEvaluatorRegistry } from '../rules';
import { computeDiscount } from '../schemas/discount';

/**
 * Evaluator for offer type "auto_offer".
 * Auto-offers are discovered by the system (no code entered by customer).
 * They lean on cart-data rules (category, min_cart_value, combo) rather than
 * customer identity, which may be unknown at discovery time.
 *
 * Evaluation logic is identical to CouponEvaluator — the difference is semantic:
 * auto-offers are surfaced via /available, not /validate. Keeping them as separate
 * evaluators allows future divergence (e.g., auto-offers may have different
 * stacking defaults or eligibility logic).
 */
export class AutoOfferEvaluator implements OfferEvaluator {
  constructor(private readonly ruleRegistry: RuleEvaluatorRegistry) {}

  evaluate(offer: Offer, context: EvaluationContext): EvaluationResult {
    if (offer.status !== 'active') {
      return this.ineligible(`Offer is ${offer.status}`);
    }

    const now = new Date(context.now);
    const startsAt = new Date(offer.validity.starts_at);
    const endsAt = new Date(offer.validity.ends_at);

    if (now < startsAt) {
      return this.ineligible('Offer is not yet valid');
    }
    if (now > endsAt) {
      return this.ineligible('Offer has expired');
    }

    if (offer.usage_limits.total !== null && offer.usage_count >= offer.usage_limits.total) {
      return this.ineligible('Total usage limit reached');
    }

    if (
      offer.usage_limits.per_customer !== null &&
      context.usage.per_customer_used >= offer.usage_limits.per_customer
    ) {
      return this.ineligible('Per customer usage limit reached');
    }

    const ruleResult = this.ruleRegistry.evaluateAll(offer.rules, context);
    if (!ruleResult.passed) {
      return {
        eligible: false,
        matched_rules: [],
        failed_rule: ruleResult.failedRuleType,
        reason: `Rule failed: ${ruleResult.failedRuleType}`,
        discount: null,
      };
    }

    const discountAmount = computeDiscount(offer.discount, context.cart.amount);

    return {
      eligible: true,
      matched_rules: offer.rules.map((r) => r.rule_type),
      failed_rule: null,
      reason: null,
      discount: { ...offer.discount, amount: discountAmount },
    };
  }

  private ineligible(reason: string): EvaluationResult {
    return {
      eligible: false,
      matched_rules: [],
      failed_rule: null,
      reason,
      discount: null,
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest src/modules/offers/evaluators/auto-offer-evaluator.test.ts
```

Expected: PASS — all 5 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(evaluators): add AutoOfferEvaluator for cart-data-driven offers"
```

---

## Task 14: Combo Resolver

**Files:**
- Create: `src/modules/offers/schemas/combo.ts`
- Create: `src/modules/offers/combo/combo-resolver.ts`
- Create: `src/modules/offers/combo/index.ts`
- Test: `src/modules/offers/combo/combo-resolver.test.ts`

- [ ] **Step 1: Write failing test for ComboResolver**

```typescript
// src/modules/offers/combo/combo-resolver.test.ts
import { ComboResolver } from './combo-resolver';
import type { Offer } from '../schemas/offer';
import type { EvaluationResult } from '../schemas/evaluation';
import type { StackingPolicy } from '../schemas/evaluation';

function makeOffer(
  id: string,
  type: 'coupon' | 'auto_offer',
  discountAmount: number,
  overrides: Partial<Offer> = {},
): { offer: Offer; result: EvaluationResult } {
  const offer: Offer = {
    _id: id,
    merchant_id: 'merch_1',
    code: type === 'coupon' ? `CODE${id}` : null,
    type,
    title: `Offer ${id}`,
    discount: { type: 'flat', value: discountAmount, max_discount: null },
    subsidy_model: 'merchant',
    status: 'active',
    validity: { starts_at: '2026-01-01T00:00:00.000Z', ends_at: '2026-12-31T23:59:59.000Z' },
    usage_limits: { total: null, per_customer: null },
    usage_count: 0,
    rules: [],
    stacking: { stacks_with: null, exclusive: false, priority: 0 },
    tags: [],
    created_at: '2026-07-18T09:00:00.000Z',
    updated_at: '2026-07-18T09:00:00.000Z',
    ...overrides,
  };
  const result: EvaluationResult = {
    eligible: true,
    matched_rules: [],
    failed_rule: null,
    reason: null,
    discount: { type: 'flat', value: discountAmount, max_discount: null, amount: discountAmount },
  };
  return { offer, result };
}

const defaultPolicy: StackingPolicy = {
  max_coupons: 1,
  max_auto_offers: 1,
  max_total_discount: null,
  allow_cross_type: true,
  exclusive_tags: [],
};

describe('ComboResolver', () => {
  it('applies a single offer with no conflicts', () => {
    const resolver = new ComboResolver();
    const { offer, result } = makeOffer('1', 'coupon', 50);
    const combo = resolver.resolve([{ offer, result }], defaultPolicy, 5000);

    expect(combo.applied).toHaveLength(1);
    expect(combo.applied[0].offer_id).toBe('1');
    expect(combo.applied[0].discount_amount).toBe(50);
    expect(combo.rejected).toHaveLength(0);
    expect(combo.total_discount).toBe(50);
    expect(combo.final_amount).toBe(4950);
  });

  it('stacks a coupon + auto_offer when allow_cross_type is true', () => {
    const resolver = new ComboResolver();
    const coupon = makeOffer('1', 'coupon', 50);
    const auto = makeOffer('2', 'auto_offer', 500);
    const combo = resolver.resolve([coupon, auto], defaultPolicy, 5000);

    expect(combo.applied).toHaveLength(2);
    expect(combo.total_discount).toBe(550);
    expect(combo.final_amount).toBe(4450);
  });

  it('rejects cross-type stacking when allow_cross_type is false', () => {
    const resolver = new ComboResolver();
    const coupon = makeOffer('1', 'coupon', 50);
    const auto = makeOffer('2', 'auto_offer', 500);
    const policy: StackingPolicy = { ...defaultPolicy, allow_cross_type: false };
    const combo = resolver.resolve([coupon, auto], policy, 5000);

    // Higher discount (auto_offer) should win
    expect(combo.applied).toHaveLength(1);
    expect(combo.applied[0].offer_id).toBe('2');
    expect(combo.rejected).toHaveLength(1);
    expect(combo.rejected[0].offer_id).toBe('1');
    expect(combo.rejected[0].reason).toContain('cross-type');
  });

  it('rejects second coupon when max_coupons is 1', () => {
    const resolver = new ComboResolver();
    const coupon1 = makeOffer('1', 'coupon', 50);
    const coupon2 = makeOffer('2', 'coupon', 100);
    const combo = resolver.resolve([coupon1, coupon2], defaultPolicy, 5000);

    expect(combo.applied).toHaveLength(1);
    expect(combo.applied[0].offer_id).toBe('2'); // higher discount wins
    expect(combo.rejected).toHaveLength(1);
    expect(combo.rejected[0].reason).toContain('max_coupons');
  });

  it('enforces exclusive flag — only exclusive offer is applied', () => {
    const resolver = new ComboResolver();
    const exclusive = makeOffer('1', 'auto_offer', 1000, {
      stacking: { stacks_with: null, exclusive: true, priority: 10 },
    });
    const normal = makeOffer('2', 'coupon', 50);
    const combo = resolver.resolve([exclusive, normal], defaultPolicy, 5000);

    expect(combo.applied).toHaveLength(1);
    expect(combo.applied[0].offer_id).toBe('1');
    expect(combo.rejected).toHaveLength(1);
    expect(combo.rejected[0].reason).toContain('exclusive');
  });

  it('enforces max_total_discount cap', () => {
    const resolver = new ComboResolver();
    const coupon = makeOffer('1', 'coupon', 500);
    const auto = makeOffer('2', 'auto_offer', 600);
    const policy: StackingPolicy = { ...defaultPolicy, max_total_discount: 800 };
    const combo = resolver.resolve([coupon, auto], policy, 5000);

    // Total would be 1100, capped at 800
    expect(combo.total_discount).toBe(800);
    expect(combo.final_amount).toBe(4200);
    expect(combo.applied).toHaveLength(2); // both still applied, but total capped
  });

  it('rejects offers with exclusive_tags when another offer is present', () => {
    const resolver = new ComboResolver();
    const flash = makeOffer('1', 'auto_offer', 1000, { tags: ['flash'] });
    const normal = makeOffer('2', 'coupon', 50);
    const policy: StackingPolicy = { ...defaultPolicy, exclusive_tags: ['flash'] };
    const combo = resolver.resolve([flash, normal], policy, 5000);

    expect(combo.applied).toHaveLength(1);
    expect(combo.applied[0].offer_id).toBe('1'); // flash has higher discount
    expect(combo.rejected).toHaveLength(1);
    expect(combo.rejected[0].reason).toContain('exclusive tag');
  });

  it('respects per-offer stacks_with restriction', () => {
    const resolver = new ComboResolver();
    const coupon = makeOffer('1', 'coupon', 50);
    const auto = makeOffer('2', 'auto_offer', 500, {
      stacking: { stacks_with: ['auto_offer'], exclusive: false, priority: 0 },
    });
    // auto_offer only stacks with auto_offer, not coupon
    const combo = resolver.resolve([coupon, auto], defaultPolicy, 5000);

    expect(combo.applied).toHaveLength(1);
    expect(combo.applied[0].offer_id).toBe('2'); // higher discount
    expect(combo.rejected).toHaveLength(1);
    expect(combo.rejected[0].reason).toContain('stacks_with');
  });

  it('returns empty applied when no offers are eligible', () => {
    const resolver = new ComboResolver();
    const combo = resolver.resolve([], defaultPolicy, 5000);

    expect(combo.applied).toHaveLength(0);
    expect(combo.rejected).toHaveLength(0);
    expect(combo.total_discount).toBe(0);
    expect(combo.final_amount).toBe(5000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/modules/offers/combo/combo-resolver.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement ComboResolverSchema (combo result types)**

```typescript
// src/modules/offers/schemas/combo.ts
import { z } from 'zod';

/**
 * Schema for a single applied offer in a combo result.
 */
export const AppliedOfferSchema = z.object({
  offer_id: z.string(),
  discount_amount: z.number().nonnegative(),
});

/**
 * Schema for a single rejected offer in a combo result.
 */
export const RejectedOfferSchema = z.object({
  offer_id: z.string(),
  reason: z.string(),
});

/**
 * Schema for the result of ComboResolver.resolve().
 * Contains the final set of applied offers (with discounts),
 * rejected offers (with reasons), and the total discount and final amount.
 */
export const ComboResultSchema = z.object({
  applied: z.array(AppliedOfferSchema),
  rejected: z.array(RejectedOfferSchema),
  total_discount: z.number().nonnegative(),
  final_amount: z.number().nonnegative(),
});

/** Applied offer in combo — inferred from schema. */
export type AppliedOffer = z.infer<typeof AppliedOfferSchema>;

/** Rejected offer in combo — inferred from schema. */
export type RejectedOffer = z.infer<typeof RejectedOfferSchema>;

/** Combo resolution result — inferred from schema. */
export type ComboResult = z.infer<typeof ComboResultSchema>;
```

- [ ] **Step 4: Implement ComboResolver**

```typescript
// src/modules/offers/combo/combo-resolver.ts
import type { Offer } from '../schemas/offer';
import type { EvaluationResult, StackingPolicy } from '../schemas/evaluation';
import type { ComboResult, AppliedOffer, RejectedOffer } from '../schemas/combo';

/**
 * Input item for ComboResolver: an offer paired with its evaluation result.
 * Only eligible offers should be passed to the resolver.
 */
interface ComboInput {
  offer: Offer;
  result: EvaluationResult;
}

/**
 * Resolves stacking conflicts between multiple eligible offers.
 * Applies the merchant's global stacking policy + per-offer overrides.
 *
 * Resolution algorithm:
 * 1. Sort by priority (exclusive first, then by discount descending)
 * 2. If an exclusive offer is selected, reject all others
 * 3. Enforce global limits (max_coupons, max_auto_offers)
 * 4. If !allow_cross_type, only one offer type allowed total
 * 5. Check per-offer stacks_with restrictions
 * 6. Sum discounts, enforce max_total_discount cap if set
 */
export class ComboResolver {
  /**
   * Resolves a set of eligible offers into the final applied set.
   *
   * @param inputs - Array of { offer, result } for eligible offers
   * @param policy - Merchant's global stacking policy
   * @param cartAmount - Total cart amount before discount
   * @returns Combo result with applied offers, rejected offers, and totals
   */
  resolve(inputs: ComboInput[], policy: StackingPolicy, cartAmount: number): ComboResult {
    if (inputs.length === 0) {
      return { applied: [], rejected: [], total_discount: 0, final_amount: cartAmount };
    }

    // 1. Sort by priority (desc), then by discount (desc)
    const sorted = [...inputs].sort((a, b) => {
      const priorityDiff = b.offer.stacking.priority - a.offer.stacking.priority;
      if (priorityDiff !== 0) return priorityDiff;
      return (b.result.discount?.amount ?? 0) - (a.result.discount?.amount ?? 0);
    });

    const applied: AppliedOffer[] = [];
    const rejected: RejectedOffer[] = [];
    let couponCount = 0;
    let autoOfferCount = 0;
    let hasExclusive = false;
    const appliedTypes: string[] = [];

    for (const { offer, result } of sorted) {
      const discountAmount = result.discount?.amount ?? 0;

      // 2. If an exclusive offer was already applied, reject all others
      if (hasExclusive) {
        rejected.push({ offer_id: offer._id, reason: 'Another exclusive offer is active' });
        continue;
      }

      // 3. Check if this offer is exclusive
      if (offer.stacking.exclusive) {
        // Reject all previously applied offers
        for (const a of applied) {
          rejected.push({ offer_id: a.offer_id, reason: 'Exclusive offer selected' });
        }
        applied.length = 0;
        appliedTypes.length = 0;
        couponCount = 0;
        autoOfferCount = 0;
        hasExclusive = true;
      }

      // 4. Check exclusive_tags
      const hasExclusiveTag = offer.tags.some((tag) => policy.exclusive_tags.includes(tag));
      if (hasExclusiveTag && applied.length > 0) {
        // This offer has an exclusive tag and others are applied — reject others, apply this
        for (const a of applied) {
          rejected.push({ offer_id: a.offer_id, reason: `Exclusive tag: ${offer.tags.join(', ')}` });
        }
        applied.length = 0;
        appliedTypes.length = 0;
        couponCount = 0;
        autoOfferCount = 0;
      }

      // 5. Check global limits
      if (offer.type === 'coupon' && couponCount >= policy.max_coupons) {
        rejected.push({ offer_id: offer._id, reason: `Exceeds max_coupons (${policy.max_coupons})` });
        continue;
      }
      if (offer.type === 'auto_offer' && autoOfferCount >= policy.max_auto_offers) {
        rejected.push({ offer_id: offer._id, reason: `Exceeds max_auto_offers (${policy.max_auto_offers})` });
        continue;
      }

      // 6. Check allow_cross_type
      if (!policy.allow_cross_type && applied.length > 0 && !appliedTypes.includes(offer.type)) {
        rejected.push({ offer_id: offer._id, reason: 'Cross-type stacking not allowed' });
        continue;
      }

      // 7. Check per-offer stacks_with
      if (offer.stacking.stacks_with !== null) {
        const canStack = appliedTypes.every((t) => offer.stacking.stacks_with?.includes(t));
        if (!canStack && applied.length > 0) {
          rejected.push({ offer_id: offer._id, reason: 'Restricted by stacks_with policy' });
          continue;
        }
        // Also check if already-applied offers restrict stacking with this type
        const blockedByApplied = inputs.some(
          (other) =>
            applied.some((a) => a.offer_id === other.offer._id) &&
            other.offer.stacking.stacks_with !== null &&
            !other.offer.stacking.stacks_with.includes(offer.type),
        );
        if (blockedByApplied) {
          rejected.push({ offer_id: offer._id, reason: 'Restricted by stacks_with policy' });
          continue;
        }
      }

      // All checks passed — apply
      applied.push({ offer_id: offer._id, discount_amount: discountAmount });
      appliedTypes.push(offer.type);
      if (offer.type === 'coupon') couponCount++;
      if (offer.type === 'auto_offer') autoOfferCount++;
    }

    // 8. Sum discounts, enforce max_total_discount cap
    let totalDiscount = applied.reduce((sum, a) => sum + a.discount_amount, 0);
    if (policy.max_total_discount !== null && totalDiscount > policy.max_total_discount) {
      totalDiscount = policy.max_total_discount;
    }

    // Never discount more than the cart amount
    totalDiscount = Math.min(totalDiscount, cartAmount);

    return {
      applied,
      rejected,
      total_discount: totalDiscount,
      final_amount: cartAmount - totalDiscount,
    };
  }
}
```

- [ ] **Step 5: Implement combo index**

```typescript
// src/modules/offers/combo/index.ts
export { ComboResolver } from './combo-resolver';
```

- [ ] **Step 6: Run test to verify it passes**

```bash
npx jest src/modules/offers/combo/combo-resolver.test.ts
```

Expected: PASS — all 9 tests.

- [ ] **Step 7: Run all tests, lint, typecheck**

```bash
npx jest
npm run lint
npm run typecheck
```

Expected: All pass.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(combo): add ComboResolver with stacking policy, exclusive, and cap logic"
```

---

## Task 15: Module Public Interface & Registry Wiring

**Files:**
- Create: `src/modules/offers/types/index.ts`
- Create: `src/modules/offers/index.ts`
- Modify: `src/index.ts`
- Test: `src/modules/offers/index.test.ts`

- [ ] **Step 1: Write failing test for module public interface**

```typescript
// src/modules/offers/index.test.ts
import { createOfferModule } from './index';
import type { OfferService } from './types';

describe('createOfferModule', () => {
  it('returns an OfferService with evaluate and evaluateEligible methods', () => {
    const service: OfferService = createOfferModule();
    expect(service).toBeDefined();
    expect(typeof service.evaluate).toBe('function');
    expect(typeof service.evaluateEligible).toBe('function');
    expect(typeof service.resolveCombo).toBe('function');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/modules/offers/index.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement module public interface (types)**

```typescript
// src/modules/offers/types/index.ts
import type { Offer } from '../schemas/offer';
import type { EvaluationContext, EvaluationResult, StackingPolicy } from '../schemas/evaluation';
import type { ComboResult } from '../schemas/combo';

/**
 * Public service interface for the offers module.
 * This is the contract other modules depend on — never import concrete classes.
 * When extracting to a microservice, a RemoteOfferServiceAdapter implements this interface.
 */
export interface OfferService {
  /**
   * Evaluates a single offer against a context.
   * @param offer - The offer to evaluate
   * @param context - Cart, customer, and usage data
   * @returns Evaluation result with eligibility and discount
   */
  evaluate(offer: Offer, context: EvaluationContext): EvaluationResult;

  /**
   * Evaluates multiple offers and returns only the eligible ones.
   * @param offers - Array of offers
   * @param context - Evaluation context
   * @returns Array of { offer, result } for eligible offers
   */
  evaluateEligible(
    offers: Offer[],
    context: EvaluationContext,
  ): Array<{ offer: Offer; result: EvaluationResult }>;

  /**
   * Resolves stacking conflicts across eligible offers.
   * @param eligibleOffers - Offers that passed evaluation
   * @param policy - Merchant stacking policy
   * @param cartAmount - Cart total before discount
   * @returns Combo result with applied, rejected, and totals
   */
  resolveCombo(
    eligibleOffers: Array<{ offer: Offer; result: EvaluationResult }>,
    policy: StackingPolicy,
    cartAmount: number,
  ): ComboResult;
}

/**
 * Public interface for offer data access.
 * Repository implementations (Mongo, in-memory, remote) implement this.
 */
export interface OfferRepository {
  findById(id: string, merchantId: string): Promise<Offer | null>;
  findByCode(code: string, merchantId: string): Promise<Offer | null>;
  findByMerchant(merchantId: string): Promise<Offer[]>;
  save(offer: Offer): Promise<Offer>;
  delete(id: string, merchantId: string): Promise<boolean>;
}
```

- [ ] **Step 4: Implement module factory (wiring concrete implementations to interfaces)**

```typescript
// src/modules/offers/index.ts
import { OfferEvaluatorRegistry } from './evaluators';
import { CouponEvaluator } from './evaluators/coupon-evaluator';
import { AutoOfferEvaluator } from './evaluators/auto-offer-evaluator';
import { RuleEvaluatorRegistry } from './rules';
import { ComboResolver } from './combo';
import { minCartValue } from './rules/min-cart-value';
import { maxCartValue } from './rules/max-cart-value';
import { customerSegment } from './rules/customer-segment';
import { firstTimeBuyer } from './rules/first-time-buyer';
import { perCustomerLimit } from './rules/per-customer-limit';
import { totalUsageLimit } from './rules/total-usage-limit';
import { categoryRestriction } from './rules/category-restriction';
import { productRestriction } from './rules/product-restriction';
import { brandRestriction } from './rules/brand-restriction';
import { productCombo } from './rules/product-combo';
import { timeWindow } from './rules/time-window';
import { weekendOnly } from './rules/weekend-only';
import { dateRange } from './rules/date-range';
import type { OfferService } from './types';
import type { Offer } from './schemas/offer';
import type { EvaluationContext, EvaluationResult, StackingPolicy } from './schemas/evaluation';
import type { ComboResult } from './schemas/combo';

// PUBLIC: only export interfaces and types (module contract)
export type { OfferService, OfferRepository } from './types';
export type {
  Offer,
  Rule,
} from './schemas/offer';
export type {
  EvaluationContext,
  EvaluationResult,
  StackingPolicy,
} from './schemas/evaluation';
export type { ComboResult, AppliedOffer, RejectedOffer } from './schemas/combo';
export type { Cart, CartItem } from './schemas/cart';
export type { CustomerContext } from './schemas/customer';
export type { Discount, ComputedDiscount } from './schemas/discount';

/**
 * Factory that creates an OfferService with all evaluators and rules registered.
 * This is where concrete implementations are wired to interfaces — the composition root
 * for the offers module. Other modules receive the OfferService interface, not this factory.
 *
 * @returns OfferService instance with registered CouponEvaluator and AutoOfferEvaluator
 */
export function createOfferModule(): OfferService {
  // Register all rule evaluators
  const ruleRegistry = new RuleEvaluatorRegistry();
  ruleRegistry.register('min_cart_value', minCartValue);
  ruleRegistry.register('max_cart_value', maxCartValue);
  ruleRegistry.register('customer_segment', customerSegment);
  ruleRegistry.register('first_time_buyer', firstTimeBuyer);
  ruleRegistry.register('per_customer_limit', perCustomerLimit);
  ruleRegistry.register('total_usage_limit', totalUsageLimit);
  ruleRegistry.register('category_restriction', categoryRestriction);
  ruleRegistry.register('product_restriction', productRestriction);
  ruleRegistry.register('brand_restriction', brandRestriction);
  ruleRegistry.register('product_combo', productCombo);
  ruleRegistry.register('time_window', timeWindow);
  ruleRegistry.register('weekend_only', weekendOnly);
  ruleRegistry.register('date_range', dateRange);

  // Register offer type evaluators
  const offerRegistry = new OfferEvaluatorRegistry();
  offerRegistry.register('coupon', new CouponEvaluator(ruleRegistry));
  offerRegistry.register('auto_offer', new AutoOfferEvaluator(ruleRegistry));

  // Create combo resolver
  const comboResolver = new ComboResolver();

  // Return service that implements the OfferService interface
  return {
    evaluate: (offer: Offer, context: EvaluationContext): EvaluationResult =>
      offerRegistry.evaluate(offer, context),

    evaluateEligible: (
      offers: Offer[],
      context: EvaluationContext,
    ): Array<{ offer: Offer; result: EvaluationResult }> =>
      offerRegistry.evaluateEligible(offers, context),

    resolveCombo: (
      eligibleOffers: Array<{ offer: Offer; result: EvaluationResult }>,
      policy: StackingPolicy,
      cartAmount: number,
    ): ComboResult => {
      const inputs = eligibleOffers.map(({ offer, result }) => ({ offer, result }));
      return comboResolver.resolve(inputs, policy, cartAmount);
    },
  };
}
```

- [ ] **Step 5: Update src/index.ts to export the module**

```typescript
// src/index.ts
export { config } from './config/index';
export { createOfferModule } from './modules/offers';
export type {
  OfferService,
  OfferRepository,
  Offer,
  Rule,
  EvaluationContext,
  EvaluationResult,
  StackingPolicy,
  ComboResult,
  AppliedOffer,
  RejectedOffer,
  Cart,
  CartItem,
  CustomerContext,
  Discount,
  ComputedDiscount,
} from './modules/offers';
```

- [ ] **Step 6: Run test to verify it passes**

```bash
npx jest src/modules/offers/index.test.ts
```

Expected: PASS.

- [ ] **Step 7: Run all tests, lint, typecheck, coverage**

```bash
npx jest
npm run lint
npm run typecheck
npx jest --coverage
```

Expected: All tests pass, no lint errors, no type errors. Coverage on rule engine files should be 90%+.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(offers): wire module factory with all rules, evaluators, and combo resolver

Export only interfaces and types from the offers module (modular monolith
contract). createOfferModule() is the composition root that wires concrete
implementations to the OfferService interface."
```

---

## Summary

This plan covers the **Core Engine** (Phase 1 from the PRD):
- 15 tasks, each following TDD (red-green-refactor)
- 13 rule evaluators (pure functions, fully tested)
- 2 offer evaluators (CouponEvaluator, AutoOfferEvaluator)
- ComboResolver (stacking/conflict resolution)
- All types inferred from Zod schemas
- Modular monolith: modules export interfaces, factory wires concretes
- No database, no API — pure logic, 100% testable

**Next plans:**
- Part 2: API Layer (Fastify server, MongoDB, endpoints, auth, rate limiting)
- Part 3: Dashboard (Next.js frontend, offer creation UI, analytics)
