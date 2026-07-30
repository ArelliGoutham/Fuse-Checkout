# EMI Campaign Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an EMI campaign engine that validates no-cost/low-cost EMI offers based on card IIN, card tier, product eligibility, and velocity limits — with support for both merchant-scoped and brand-scoped (cross-merchant) campaigns with IMEI blocking for brand subsidies.

**Architecture:** New schemas, services, and routes in the existing `src/modules/checkout/` module. The IIN lookup service replaces the hardcoded `bin-lookup.ts` with a database-backed IIN table. The campaign engine is a pure function that validates eligibility. Brand campaigns support cross-merchant velocity with IMEI blocking requirements. All follows the modular monolith pattern with Zod schemas, TDD, and interface-only communication.

**Tech Stack:** TypeScript, Zod, Fastify, MongoDB, Jest

---

## File Structure

| File | Responsibility |
|---|---|
| `src/modules/checkout/schemas/iin-range.ts` | Zod schemas for IIN ranges (6-digit prefix to bank, tier, network) |
| `src/modules/checkout/schemas/emi-campaign.ts` | Zod schemas for EMI campaigns (eligibility rules, velocity, scope) |
| `src/modules/checkout/schemas/subsidy-ledger.ts` | Zod schema for brand subsidy ledger entries |
| `src/modules/checkout/services/iin-database.ts` | IIN lookup service (in-memory, DB-loadable) |
| `src/modules/checkout/services/iin-database.test.ts` | Tests for IIN lookup |
| `src/modules/checkout/services/emi-campaign-engine.ts` | Pure function: validate campaign eligibility |
| `src/modules/checkout/services/emi-campaign-engine.test.ts` | Tests for campaign engine |
| `src/modules/checkout/routes/emi-campaign-routes.ts` | Admin CRUD routes for EMI campaigns |
| `src/modules/checkout/routes/iin-range-routes.ts` | Admin CRUD routes for IIN ranges |
| `scripts/seed-iin.ts` | Seed 50 premium Indian card IINs + sample campaigns |
| `src/modules/checkout/routes/checkout-routes.ts` (modify) | Wire campaign engine into select-payment endpoint |
| `src/server.ts` (modify) | Register new routes |

---

## Task 1: IIN Range Schema

**Files:**
- Create: `src/modules/checkout/schemas/iin-range.ts`

- [ ] **Step 1: Create the IIN range schemas**

```typescript
import { z } from 'zod';

export const IINRangeSchema = z.object({
  _id: z.string().optional(),
  prefix: z.string().length(6).regex(/^\d+$/, 'Must be 6-digit numeric prefix'),
  bank_code: z.string().min(1),
  bank_name: z.string().min(1),
  card_type: z.enum(['credit', 'debit']),
  card_tier: z.enum([
    'standard', 'gold', 'platinum', 'signature', 'world', 'infinite',
    'select', 'coral', 'rubyx', 'sapphire', 'magnus', 'white', 'elite',
    'business', 'corporate', 'prepaid',
  ]),
  card_network: z.enum(['visa', 'mastercard', 'rupay', 'amex', 'diners']),
  status: z.enum(['active', 'inactive']).default('active'),
  updated_at: z.string().datetime().optional(),
});

export const CreateIINRangeSchema = z.object({
  prefix: z.string().length(6).regex(/^\d+$/, 'Must be 6-digit numeric prefix'),
  bank_code: z.string().min(1),
  bank_name: z.string().min(1),
  card_type: z.enum(['credit', 'debit']),
  card_tier: z.enum([
    'standard', 'gold', 'platinum', 'signature', 'world', 'infinite',
    'select', 'coral', 'rubyx', 'sapphire', 'magnus', 'white', 'elite',
    'business', 'corporate', 'prepaid',
  ]).default('standard'),
  card_network: z.enum(['visa', 'mastercard', 'rupay', 'amex', 'diners']).default('visa'),
});

export type IINRange = z.infer<typeof IINRangeSchema>;
export type CreateIINRangeInput = z.infer<typeof CreateIINRangeSchema>;
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/checkout/schemas/iin-range.ts
git commit -m "feat(checkout): add IIN range schema for card BIN to tier mapping"
```

---

## Task 2: EMI Campaign Schema

**Files:**
- Create: `src/modules/checkout/schemas/emi-campaign.ts`

- [ ] **Step 1: Create the EMI campaign schemas**

```typescript
import { z } from 'zod';

export const EMICampaignSchema = z.object({
  _id: z.string(),
  code: z.string().min(1),
  title: z.string().min(1),
  scope: z.enum(['merchant', 'brand']),
  merchant_id: z.string().nullable(),
  brand: z.string().nullable(),
  bank: z.string().min(1),
  iin_prefixes: z.array(z.string().length(6)),
  card_tiers: z.array(z.string()),
  emi_type: z.enum(['no_cost', 'low_cost']),
  products: z.array(z.string()).nullable(),
  max_total: z.number().int().positive(),
  max_per_merchant: z.number().int().positive().nullable(),
  max_per_card: z.number().int().positive(),
  subsidy_amount: z.number().nonnegative().nullable(),
  requires_imei: z.boolean().default(false),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  status: z.enum(['active', 'inactive']).default('active'),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const CreateEMICampaignSchema = z.object({
  code: z.string().min(1),
  title: z.string().min(1),
  scope: z.enum(['merchant', 'brand']),
  merchant_id: z.string().nullable().default(null),
  brand: z.string().nullable().default(null),
  bank: z.string().min(1),
  iin_prefixes: z.array(z.string().length(6)).min(1),
  card_tiers: z.array(z.string()).min(1),
  emi_type: z.enum(['no_cost', 'low_cost']),
  products: z.array(z.string()).nullable().default(null),
  max_total: z.number().int().positive(),
  max_per_merchant: z.number().int().positive().nullable().default(null),
  max_per_card: z.number().int().positive().default(2),
  subsidy_amount: z.number().nonnegative().nullable().default(null),
  requires_imei: z.boolean().default(false),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
});

export type EMICampaign = z.infer<typeof EMICampaignSchema>;
export type CreateEMICampaignInput = z.infer<typeof CreateEMICampaignSchema>;
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/checkout/schemas/emi-campaign.ts
git commit -m "feat(checkout): add EMI campaign schema with merchant/brand scope"
```

---

## Task 3: Subsidy Ledger Schema

**Files:**
- Create: `src/modules/checkout/schemas/subsidy-ledger.ts`

- [ ] **Step 1: Create the subsidy ledger schema**

```typescript
import { z } from 'zod';

export const SubsidyLedgerSchema = z.object({
  _id: z.string(),
  order_id: z.string(),
  merchant_id: z.string(),
  campaign_id: z.string(),
  campaign_code: z.string(),
  brand: z.string().nullable(),
  amount: z.number().positive(),
  emi_type: z.enum(['no_cost', 'low_cost']),
  imei: z.string().nullable(),
  imei_blocked: z.boolean().default(false),
  imei_blocked_at: z.string().datetime().nullable(),
  settlement_status: z.enum([
    'pending', 'imei_blocked', 'settled', 'paid', 'disputed',
  ]).default('pending'),
  settlement_ref: z.string().nullable(),
  settled_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type SubsidyLedger = z.infer<typeof SubsidyLedgerSchema>;
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/checkout/schemas/subsidy-ledger.ts
git commit -m "feat(checkout): add subsidy ledger schema for brand settlement tracking"
```

---

## Task 4: IIN Lookup Service (TDD)

**Files:**
- Create: `src/modules/checkout/services/iin-database.ts`
- Test: `src/modules/checkout/services/iin-database.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/modules/checkout/services/iin-database.test.ts`:

```typescript
import { IINLookupService } from './iin-database';
import { IINRange } from '../schemas/iin-range';

describe('IINLookupService', () => {
  const sampleRanges: IINRange[] = [
    { prefix: '459130', bank_code: 'HDFC', bank_name: 'HDFC Bank', card_type: 'credit', card_tier: 'platinum', card_network: 'visa', status: 'active' },
    { prefix: '459131', bank_code: 'HDFC', bank_name: 'HDFC Bank', card_type: 'credit', card_tier: 'signature', card_network: 'visa', status: 'active' },
    { prefix: '437450', bank_code: 'HDFC', bank_name: 'HDFC Bank', card_type: 'debit', card_tier: 'platinum', card_network: 'visa', status: 'active' },
    { prefix: '402602', bank_code: 'ICICI', bank_name: 'ICICI Bank', card_type: 'credit', card_tier: 'coral', card_network: 'visa', status: 'active' },
    { prefix: '546700', bank_code: 'SBI', bank_name: 'State Bank of India', card_type: 'credit', card_tier: 'elite', card_network: 'mastercard', status: 'active' },
    { prefix: '512300', bank_code: 'AXIS', bank_name: 'Axis Bank', card_type: 'credit', card_tier: 'magnus', card_network: 'mastercard', status: 'active' },
    { prefix: '541301', bank_code: 'AXIS', bank_name: 'Axis Bank', card_type: 'credit', card_tier: 'standard', card_network: 'mastercard', status: 'inactive' },
  ];

  let service: IINLookupService;

  beforeEach(() => {
    service = new IINLookupService();
    service.loadRanges(sampleRanges);
  });

  describe('lookup', () => {
    it('returns the range matching a 6-digit BIN by prefix', () => {
      const result = service.lookup('459130');
      expect(result).not.toBeNull();
      expect(result!.prefix).toBe('459130');
      expect(result!.bank_code).toBe('HDFC');
      expect(result!.card_tier).toBe('platinum');
    });

    it('matches longer BINs by extracting the first 6 digits', () => {
      const result = service.lookup('4591306742');
      expect(result).not.toBeNull();
      expect(result!.prefix).toBe('459130');
    });

    it('returns null for unknown IIN prefixes', () => {
      expect(service.lookup('999999')).toBeNull();
    });

    it('returns null for null or short BINs', () => {
      expect(service.lookup('')).toBeNull();
      expect(service.lookup('12345')).toBeNull();
    });
  });

  describe('findByBank', () => {
    it('finds all active ranges for a given bank code', () => {
      const results = service.findByBank('HDFC');
      expect(results).toHaveLength(3);
    });

    it('filters inactive IIN ranges', () => {
      const results = service.findByBank('AXIS');
      expect(results).toHaveLength(1);
      expect(results[0].card_tier).toBe('magnus');
    });

    it('finds ranges for bank code with optional tier filter', () => {
      const results = service.findByBank('HDFC', 'platinum');
      expect(results).toHaveLength(2);
    });

    it('returns empty array for unknown bank code', () => {
      expect(service.findByBank('NONEXISTENT')).toHaveLength(0);
    });
  });

  describe('all', () => {
    it('returns all loaded ranges', () => {
      expect(service.all()).toHaveLength(sampleRanges.length);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/modules/checkout/services/iin-database.test.ts --no-coverage`
Expected: FAIL — cannot find module

- [ ] **Step 3: Write minimal implementation**

Create `src/modules/checkout/services/iin-database.ts`:

```typescript
import { IINRange } from '../schemas/iin-range';

/**
 * In-memory IIN lookup service.
 * Maps 6-digit IIN prefixes to bank, card type, tier, and network.
 * Load from MongoDB at startup or use in-memory for tests.
 */
export class IINLookupService {
  private ranges: IINRange[] = [];

  loadRanges(ranges: IINRange[]): void {
    this.ranges = ranges;
  }

  lookup(bin: string): IINRange | null {
    if (!bin || bin.length < 6) return null;
    const prefix = bin.substring(0, 6);
    return this.ranges.find(r => r.prefix === prefix) || null;
  }

  findByBank(bankCode: string, tier?: string): IINRange[] {
    return this.ranges.filter(r =>
      r.bank_code === bankCode &&
      (!tier || r.card_tier === tier) &&
      r.status === 'active'
    );
  }

  all(): IINRange[] {
    return this.ranges;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/modules/checkout/services/iin-database.test.ts --no-coverage`
Expected: PASS — 10 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/modules/checkout/services/iin-database.ts src/modules/checkout/services/iin-database.test.ts
git commit -m "feat(checkout): add IIN lookup service with TDD"
```

---

## Task 5: EMI Campaign Eligibility Engine (TDD)

**Files:**
- Create: `src/modules/checkout/services/emi-campaign-engine.ts`
- Test: `src/modules/checkout/services/emi-campaign-engine.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/modules/checkout/services/emi-campaign-engine.test.ts`:

```typescript
import { validateCampaignEligibility } from './emi-campaign-engine';
import { EMICampaign } from '../schemas/emi-campaign';
import { IINRange } from '../schemas/iin-range';

const baseCampaign: EMICampaign = {
  _id: 'camp_1',
  code: 'HDFC-PREMIUM-JULY',
  title: 'HDFC Platinum No-Cost EMI',
  scope: 'merchant',
  merchant_id: 'merch_demo',
  brand: null,
  bank: 'HDFC',
  iin_prefixes: ['459130', '459131'],
  card_tiers: ['platinum', 'signature'],
  emi_type: 'no_cost',
  products: null,
  max_total: 100,
  max_per_merchant: null,
  max_per_card: 2,
  subsidy_amount: null,
  requires_imei: false,
  starts_at: '2026-07-01T00:00:00.000Z',
  ends_at: '2026-12-31T23:59:59.000Z',
  status: 'active',
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-01T00:00:00.000Z',
};

const baseCardInfo: IINRange = {
  prefix: '459130',
  bank_code: 'HDFC',
  bank_name: 'HDFC Bank',
  card_type: 'credit',
  card_tier: 'platinum',
  card_network: 'visa',
  status: 'active',
};

const baseCounts = {
  total_redemptions: 0,
  merchant_redemptions: 0,
  card_redemptions: 0,
};

const callWith = (overrides: Record<string, unknown>) => ({
  campaign: baseCampaign,
  cardInfo: baseCardInfo,
  cartAmount: 50000,
  productSkus: ['SKU-1'],
  merchantId: 'merch_demo',
  redemptionCounts: baseCounts,
  now: new Date('2026-07-21T12:00:00.000Z'),
  ...overrides,
});

describe('validateCampaignEligibility', () => {
  it('returns eligible when all checks pass', () => {
    const result = validateCampaignEligibility(callWith({}));
    expect(result.eligible).toBe(true);
    expect(result.reason).toBeNull();
  });

  it('returns ineligible when IIN prefix does not match', () => {
    const result = validateCampaignEligibility(callWith({
      cardInfo: { ...baseCardInfo, prefix: '999999' },
    }));
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('IIN');
  });

  it('returns ineligible when card tier does not match', () => {
    const result = validateCampaignEligibility(callWith({
      cardInfo: { ...baseCardInfo, card_tier: 'standard' },
    }));
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('tier');
  });

  it('returns ineligible when product not in campaign list', () => {
    const result = validateCampaignEligibility(callWith({
      campaign: { ...baseCampaign, products: ['SKU-IP15'] },
      productSkus: ['SKU-S24'],
    }));
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('product');
  });

  it('returns eligible when products is null (all products)', () => {
    const result = validateCampaignEligibility(callWith({
      campaign: { ...baseCampaign, products: null },
      productSkus: ['SKU-ANYTHING'],
    }));
    expect(result.eligible).toBe(true);
  });

  it('returns ineligible when campaign total exceeded', () => {
    const result = validateCampaignEligibility(callWith({
      redemptionCounts: { ...baseCounts, total_redemptions: 100 },
    }));
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('campaign cap');
  });

  it('returns ineligible when per-card velocity exceeded', () => {
    const result = validateCampaignEligibility(callWith({
      redemptionCounts: { ...baseCounts, card_redemptions: 2 },
    }));
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('per-card');
  });

  it('returns ineligible when per-merchant cap exceeded for brand campaign', () => {
    const result = validateCampaignEligibility(callWith({
      campaign: { ...baseCampaign, scope: 'brand', merchant_id: null, brand: 'Samsung', max_per_merchant: 50 },
      redemptionCounts: { ...baseCounts, merchant_redemptions: 50 },
    }));
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('per-merchant');
  });

  it('returns ineligible when date is outside campaign window', () => {
    const result = validateCampaignEligibility(callWith({
      now: new Date('2027-01-01T00:00:00.000Z'),
    }));
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('expired');
  });

  it('returns ineligible when campaign status is inactive', () => {
    const result = validateCampaignEligibility(callWith({
      campaign: { ...baseCampaign, status: 'inactive' },
    }));
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('inactive');
  });

  it('returns ineligible for merchant campaign when merchant mismatch', () => {
    const result = validateCampaignEligibility(callWith({
      campaign: { ...baseCampaign, merchant_id: 'merch_other' },
      merchantId: 'merch_demo',
    }));
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('merchant');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/modules/checkout/services/emi-campaign-engine.test.ts --no-coverage`
Expected: FAIL — cannot find module

- [ ] **Step 3: Write minimal implementation**

Create `src/modules/checkout/services/emi-campaign-engine.ts`:

```typescript
import { EMICampaign } from '../schemas/emi-campaign';
import { IINRange } from '../schemas/iin-range';

export interface RedemptionCounts {
  total_redemptions: number;
  merchant_redemptions: number;
  card_redemptions: number;
}

export interface CampaignValidationInput {
  campaign: EMICampaign;
  cardInfo: IINRange;
  cartAmount: number;
  productSkus: string[];
  merchantId: string;
  redemptionCounts: RedemptionCounts;
  now: Date;
}

export interface CampaignValidationResult {
  eligible: boolean;
  reason: string | null;
}

/**
 * Validates whether a card is eligible for an EMI campaign.
 * Checks: status, IIN match, tier match, product match, scope/merchant,
 * campaign cap, per-merchant cap, per-card velocity, date window.
 */
export function validateCampaignEligibility(input: CampaignValidationInput): CampaignValidationResult {
  const { campaign, cardInfo, productSkus, merchantId, redemptionCounts, now } = input;

  if (campaign.status !== 'active') {
    return { eligible: false, reason: 'Campaign is inactive' };
  }

  if (!campaign.iin_prefixes.includes(cardInfo.prefix)) {
    return { eligible: false, reason: 'Card IIN does not match campaign eligible IINs' };
  }

  if (!campaign.card_tiers.includes(cardInfo.card_tier)) {
    return { eligible: false, reason: 'Card tier does not match campaign eligible tiers' };
  }

  if (campaign.products && !campaign.products.some(p => productSkus.includes(p))) {
    return { eligible: false, reason: 'Product does not match campaign eligible products' };
  }

  if (campaign.scope === 'merchant' && campaign.merchant_id !== merchantId) {
    return { eligible: false, reason: 'Campaign does not apply to this merchant' };
  }

  if (redemptionCounts.total_redemptions >= campaign.max_total) {
    return { eligible: false, reason: 'Campaign cap reached' };
  }

  if (campaign.max_per_merchant && redemptionCounts.merchant_redemptions >= campaign.max_per_merchant) {
    return { eligible: false, reason: 'Per-merchant cap reached' };
  }

  if (redemptionCounts.card_redemptions >= campaign.max_per_card) {
    return { eligible: false, reason: 'Per-card limit reached' };
  }

  const nowMs = now.getTime();
  if (nowMs < new Date(campaign.starts_at).getTime() || nowMs > new Date(campaign.ends_at).getTime()) {
    return { eligible: false, reason: 'Campaign has expired or not yet started' };
  }

  return { eligible: true, reason: null };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/modules/checkout/services/emi-campaign-engine.test.ts --no-coverage`
Expected: PASS — 11 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/modules/checkout/services/emi-campaign-engine.ts src/modules/checkout/services/emi-campaign-engine.test.ts
git commit -m "feat(checkout): add EMI campaign eligibility engine with TDD"
```

---

## Task 6: EMI Campaign Admin Routes

**Files:**
- Create: `src/modules/checkout/routes/emi-campaign-routes.ts`
- Modify: `src/server.ts` (add import + register call)

- [ ] **Step 1: Create the campaign routes file**

Create `src/modules/checkout/routes/emi-campaign-routes.ts`:

```typescript
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { CreateEMICampaignSchema, EMICampaignSchema } from '../schemas/emi-campaign';
import type { EMICampaign } from '../schemas/emi-campaign';

export function registerEMICampaignRoutes(server: FastifyInstance): void {
  server.get(
    '/api/admin/emi-campaigns',
    { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = (request as any).user;
      if (!user) {
        return reply.code(401).send({
          error: { code: 'AUTH_INVALID', message: 'Missing authentication' },
        });
      }
      const db = server.db!;
      try {
        const campaigns = await db.collection('emi_campaigns').find({}).toArray();
        return reply.send({ campaigns: campaigns.map((c: unknown) => EMICampaignSchema.parse(c)) });
      } catch {
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve EMI campaigns' },
        });
      }
    }
  );

  server.post<{ Body: z.infer<typeof CreateEMICampaignSchema> }>(
    '/api/admin/emi-campaigns',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = (request as any).user;
      if (!user) {
        return reply.code(401).send({
          error: { code: 'AUTH_INVALID', message: 'Missing authentication' },
        });
      }
      const parseResult = CreateEMICampaignSchema.safeParse(request.body as Record<string, unknown>);
      if (!parseResult.success) {
        return reply.code(400).send({
          error: { code: 'VALIDATION_ERROR', message: parseResult.error.message },
        });
      }
      const db = server.db!;
      const now = new Date().toISOString();
      const id = `camp_${parseResult.data.code.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      const campaign: EMICampaign = {
        _id: id,
        ...parseResult.data,
        status: 'active',
        created_at: now,
        updated_at: now,
      };
      try {
        await db.collection('emi_campaigns').insertOne(campaign as any);
        return reply.code(201).send(campaign);
      } catch (error: any) {
        if (error.code === 11000) {
          return reply.code(409).send({
            error: { code: 'DUPLICATE_CAMPAIGN', message: 'EMI campaign already exists' },
          });
        }
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Failed to create EMI campaign' },
        });
      }
    }
  );

  server.get<{ Params: { id: string } }>(
    '/api/admin/emi-campaigns/:id',
    { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = (request as any).user;
      if (!user) {
        return reply.code(401).send({
          error: { code: 'AUTH_INVALID', message: 'Missing authentication' },
        });
      }
      const { id } = request.params as { id: string };
      const db = server.db!;
      try {
        const campaign = await db.collection('emi_campaigns').findOne({ _id: id as any });
        if (!campaign) {
          return reply.code(404).send({
            error: { code: 'CAMPAIGN_NOT_FOUND', message: 'EMI campaign not found' },
          });
        }
        return reply.send(EMICampaignSchema.parse(campaign));
      } catch {
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve EMI campaign' },
        });
      }
    }
  );

  server.patch<{
    Params: { id: string };
    Body: Partial<z.infer<typeof CreateEMICampaignSchema>>;
  }>(
    '/api/admin/emi-campaigns/:id',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = (request as any).user;
      if (!user) {
        return reply.code(401).send({
          error: { code: 'AUTH_INVALID', message: 'Missing authentication' },
        });
      }
      const { id } = request.params as { id: string };
      const db = server.db!;
      const UpdateSchema = z.object({
        status: z.enum(['active', 'inactive']).optional(),
        max_total: z.number().int().positive().optional(),
        max_per_merchant: z.number().int().positive().nullable().optional(),
        max_per_card: z.number().int().positive().optional(),
        starts_at: z.string().datetime().optional(),
        ends_at: z.string().datetime().optional(),
      });
      const parseResult = UpdateSchema.safeParse(request.body as Record<string, unknown>);
      if (!parseResult.success) {
        return reply.code(400).send({
          error: { code: 'VALIDATION_ERROR', message: parseResult.error.message },
        });
      }
      try {
        const result = await db.collection('emi_campaigns').findOneAndUpdate(
          { _id: id as any },
          { $set: { ...parseResult.data, updated_at: new Date().toISOString() } },
          { returnDocument: 'after' }
        );
        if (!result) {
          return reply.code(404).send({
            error: { code: 'CAMPAIGN_NOT_FOUND', message: 'EMI campaign not found' },
          });
        }
        return reply.send(EMICampaignSchema.parse(result));
      } catch {
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Failed to update EMI campaign' },
        });
      }
    }
  );
}
```

- [ ] **Step 2: Wire into server.ts**

Add import after bank-rate import:

```typescript
import { registerEMICampaignRoutes } from './modules/checkout/routes/emi-campaign-routes';
```

Add registration after `registerBankRateRoutes(server);`:

```typescript
registerEMICampaignRoutes(server);
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/checkout/routes/emi-campaign-routes.ts src/server.ts
git commit -m "feat(checkout): add EMI campaign admin CRUD routes"
```

---

## Task 7: IIN Range Admin Routes

**Files:**
- Create: `src/modules/checkout/routes/iin-range-routes.ts`
- Modify: `src/server.ts` (add import + register call)

- [ ] **Step 1: Create the IIN range routes file**

Create `src/modules/checkout/routes/iin-range-routes.ts`:

```typescript
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { CreateIINRangeSchema, IINRangeSchema } from '../schemas/iin-range';
import type { IINRange } from '../schemas/iin-range';

export function registerIINRangeRoutes(server: FastifyInstance): void {
  server.get(
    '/api/admin/iin-ranges',
    { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = (request as any).user;
      if (!user) {
        return reply.code(401).send({
          error: { code: 'AUTH_INVALID', message: 'Missing authentication' },
        });
      }
      const db = server.db!;
      try {
        const ranges = await db.collection('iin_ranges').find({ status: 'active' }).toArray();
        return reply.send({ iin_ranges: ranges.map((r: unknown) => IINRangeSchema.parse(r)) });
      } catch {
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve IIN ranges' },
        });
      }
    }
  );

  server.post<{ Body: z.infer<typeof CreateIINRangeSchema> }>(
    '/api/admin/iin-ranges',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = (request as any).user;
      if (!user) {
        return reply.code(401).send({
          error: { code: 'AUTH_INVALID', message: 'Missing authentication' },
        });
      }
      const parseResult = CreateIINRangeSchema.safeParse(request.body as Record<string, unknown>);
      if (!parseResult.success) {
        return reply.code(400).send({
          error: { code: 'VALIDATION_ERROR', message: parseResult.error.message },
        });
      }
      const db = server.db!;
      const id = `iin_${parseResult.data.prefix}`;
      const range: IINRange = {
        _id: id,
        ...parseResult.data,
        status: 'active',
        updated_at: new Date().toISOString(),
      };
      try {
        await db.collection('iin_ranges').insertOne(range as any);
        return reply.code(201).send(range);
      } catch (error: any) {
        if (error.code === 11000) {
          return reply.code(409).send({
            error: { code: 'DUPLICATE_IIN', message: 'IIN range already exists' },
          });
        }
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Failed to create IIN range' },
        });
      }
    }
  );
}
```

- [ ] **Step 2: Wire into server.ts**

Add import:

```typescript
import { registerIINRangeRoutes } from './modules/checkout/routes/iin-range-routes';
```

Add registration:

```typescript
registerIINRangeRoutes(server);
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/checkout/routes/iin-range-routes.ts src/server.ts
git commit -m "feat(checkout): add IIN range admin CRUD routes"
```

---

## Task 8: Wire Campaign Engine into Select-Payment

**Files:**
- Modify: `src/modules/checkout/routes/checkout-routes.ts` (lines 184-300)
- Modify: `src/modules/checkout/services/bin-lookup.ts` (keep for fallback but add IIN integration)

- [ ] **Step 1: Add imports at top of checkout-routes.ts**

Add after existing imports:

```typescript
import { IINLookupService } from '../services/iin-database';
import { validateCampaignEligibility } from '../services/emi-campaign-engine';
import type { EMICampaign } from '../schemas/emi-campaign';
```

- [ ] **Step 2: Update the select-payment handler**

Replace the EMI calculation section (after bank rate fetch) with:

```typescript
        // Look up IIN for tier info
        let iinInfo: IINRange | null = null;
        if (method === 'card' && bin) {
          const iinRanges = await db.collection('iin_ranges').find({ status: 'active' }).toArray();
          const iinService = new IINLookupService();
          iinService.loadRanges(iinRanges);
          iinInfo = iinService.lookup(bin);
        }

        // Calculate standard EMI options
        const emiOptions = [];
        if (bankRates.length > 0) {
          const bankRate = bankRates[0];
          for (const t of bankRate.tenures) {
            const emi = calculateEMI({
              principal: session.cart.amount,
              bankRate: {
                bank_name: bankRate.bank_name,
                interest_rate: bankRate.interest_rate,
                processing_fee: bankRate.processing_fee,
              },
              tenure: t,
              emiType: 'standard',
              subsidyAmount: null,
            });
            emiOptions.push({
              tenure: t,
              monthly_emi: emi.monthly_emi,
              total_payment: emi.total_payment,
              total_interest: emi.total_interest,
              processing_fee: emi.processing_fee,
              emi_type: 'standard',
              campaign_code: null,
            });
          }
        }

        // Check for eligible EMI campaigns
        let campaignEmiOptions = [];
        if (iinInfo && session.cart.items.length > 0) {
          const campaigns = await db.collection('emi_campaigns')
            .find({ status: 'active', bank: bankCode })
            .toArray() as EMICampaign[];

          const productSkus = session.cart.items.map((i: any) => i.sku_id);

          for (const campaign of campaigns) {
            const totalRedemptions = await db.collection('emi_redemptions')
              .countDocuments({ campaign_id: campaign._id });
            const merchantRedemptions = await db.collection('emi_redemptions')
              .countDocuments({ campaign_id: campaign._id, merchant_id: session.merchant_id });
            const cardRedemptions = await db.collection('emi_redemptions')
              .countDocuments({ campaign_id: campaign._id, card_token: bin });

            const validation = validateCampaignEligibility({
              campaign,
              cardInfo: iinInfo,
              cartAmount: session.cart.amount,
              productSkus,
              merchantId: session.merchant_id,
              redemptionCounts: {
                total_redemptions: totalRedemptions,
                merchant_redemptions: merchantRedemptions,
                card_redemptions: cardRedemptions,
              },
              now: new Date(),
            });

            if (validation.eligible && bankRates.length > 0) {
              const bankRate = bankRates[0];
              for (const t of bankRate.tenures) {
                const emi = calculateEMI({
                  principal: session.cart.amount,
                  bankRate: {
                    bank_name: bankRate.bank_name,
                    interest_rate: bankRate.interest_rate,
                    processing_fee: bankRate.processing_fee,
                  },
                  tenure: t,
                  emiType: campaign.emi_type,
                  subsidyAmount: campaign.subsidy_amount || 'full',
                });
                campaignEmiOptions.push({
                  tenure: t,
                  monthly_emi: emi.monthly_emi,
                  customer_emi: emi.customer_emi,
                  total_payment: emi.total_payment,
                  total_interest: emi.total_interest,
                  customer_interest: emi.customer_interest,
                  subsidy_amount: emi.subsidy_amount,
                  processing_fee: emi.processing_fee,
                  emi_type: campaign.emi_type,
                  campaign_code: campaign.code,
                  campaign_title: campaign.title,
                });
              }
            }
          }
        }

        return reply.send({
          method,
          bank: bankCode || null,
          iin_info: iinInfo,
          emi_options: emiOptions,
          campaign_emi_options: campaignEmiOptions,
          final_amount: session.cart.amount,
        });
```

Make sure to add `IINRange` type import at the top:

```typescript
import type { IINRange } from '../schemas/iin-range';
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/checkout/routes/checkout-routes.ts
git commit -m "feat(checkout): wire EMI campaign engine into select-payment endpoint"
```

---

## Task 9: Seed IIN Database + Sample Campaigns

**Files:**
- Create: `scripts/seed-iin.ts`

- [ ] **Step 1: Create the seed script**

Create `scripts/seed-iin.ts`:

```typescript
import { MongoClient } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/fuse?authSource=admin';
const DB_NAME = 'fuse';

const IIN_RANGES = [
  // HDFC
  { _id: 'iin_459130', prefix: '459130', bank_code: 'HDFC', bank_name: 'HDFC Bank', card_type: 'credit', card_tier: 'platinum', card_network: 'visa', status: 'active', updated_at: new Date().toISOString() },
  { _id: 'iin_459131', prefix: '459131', bank_code: 'HDFC', bank_name: 'HDFC Bank', card_type: 'credit', card_tier: 'signature', card_network: 'visa', status: 'active', updated_at: new Date().toISOString() },
  { _id: 'iin_459132', prefix: '459132', bank_code: 'HDFC', bank_name: 'HDFC Bank', card_type: 'credit', card_tier: 'infinite', card_network: 'visa', status: 'active', updated_at: new Date().toISOString() },
  { _id: 'iin_455204', prefix: '455204', bank_code: 'HDFC', bank_name: 'HDFC Bank', card_type: 'credit', card_tier: 'gold', card_network: 'visa', status: 'active', updated_at: new Date().toISOString() },
  { _id: 'iin_437450', prefix: '437450', bank_code: 'HDFC', bank_name: 'HDFC Bank', card_type: 'debit', card_tier: 'platinum', card_network: 'visa', status: 'active', updated_at: new Date().toISOString() },
  { _id: 'iin_438614', prefix: '438614', bank_code: 'HDFC', bank_name: 'HDFC Bank', card_type: 'credit', card_tier: 'business', card_network: 'visa', status: 'active', updated_at: new Date().toISOString() },
  // ICICI
  { _id: 'iin_402602', prefix: '402602', bank_code: 'ICICI', bank_name: 'ICICI Bank', card_type: 'credit', card_tier: 'coral', card_network: 'visa', status: 'active', updated_at: new Date().toISOString() },
  { _id: 'iin_455201', prefix: '455201', bank_code: 'ICICI', bank_name: 'ICICI Bank', card_type: 'credit', card_tier: 'sapphire', card_network: 'visa', status: 'active', updated_at: new Date().toISOString() },
  { _id: 'iin_438601', prefix: '438601', bank_code: 'ICICI', bank_name: 'ICICI Bank', card_type: 'credit', card_tier: 'coral', card_network: 'visa', status: 'active', updated_at: new Date().toISOString() },
  { _id: 'iin_524242', prefix: '524242', bank_code: 'ICICI', bank_name: 'ICICI Bank', card_type: 'credit', card_tier: 'sapphire', card_network: 'mastercard', status: 'active', updated_at: new Date().toISOString() },
  { _id: 'iin_402603', prefix: '402603', bank_code: 'ICICI', bank_name: 'ICICI Bank', card_type: 'credit', card_tier: 'standard', card_network: 'visa', status: 'active', updated_at: new Date().toISOString() },
  // SBI
  { _id: 'iin_546700', prefix: '546700', bank_code: 'SBI', bank_name: 'State Bank of India', card_type: 'credit', card_tier: 'elite', card_network: 'mastercard', status: 'active', updated_at: new Date().toISOString() },
  { _id: 'iin_542200', prefix: '542200', bank_code: 'SBI', bank_name: 'State Bank of India', card_type: 'credit', card_tier: 'standard', card_network: 'mastercard', status: 'active', updated_at: new Date().toISOString() },
  { _id: 'iin_437856', prefix: '437856', bank_code: 'SBI', bank_name: 'State Bank of India', card_type: 'credit', card_tier: 'platinum', card_network: 'visa', status: 'active', updated_at: new Date().toISOString() },
  { _id: 'iin_490112', prefix: '490112', bank_code: 'SBI', bank_name: 'State Bank of India', card_type: 'debit', card_tier: 'standard', card_network: 'rupay', status: 'active', updated_at: new Date().toISOString() },
  // AXIS
  { _id: 'iin_512300', prefix: '512300', bank_code: 'AXIS', bank_name: 'Axis Bank', card_type: 'credit', card_tier: 'magnus', card_network: 'mastercard', status: 'active', updated_at: new Date().toISOString() },
  { _id: 'iin_541301', prefix: '541301', bank_code: 'AXIS', bank_name: 'Axis Bank', card_type: 'credit', card_tier: 'standard', card_network: 'mastercard', status: 'active', updated_at: new Date().toISOString() },
  { _id: 'iin_455202', prefix: '455202', bank_code: 'AXIS', bank_name: 'Axis Bank', card_type: 'credit', card_tier: 'platinum', card_network: 'visa', status: 'active', updated_at: new Date().toISOString() },
  { _id: 'iin_438611', prefix: '438611', bank_code: 'AXIS', bank_name: 'Axis Bank', card_type: 'credit', card_tier: 'signature', card_network: 'visa', status: 'active', updated_at: new Date().toISOString() },
  // KOTAK
  { _id: 'iin_447700', prefix: '447700', bank_code: 'KOTAK', bank_name: 'Kotak Mahindra Bank', card_type: 'credit', card_tier: 'white', card_network: 'visa', status: 'active', updated_at: new Date().toISOString() },
  { _id: 'iin_455300', prefix: '455300', bank_code: 'KOTAK', bank_name: 'Kotak Mahindra Bank', card_type: 'credit', card_tier: 'standard', card_network: 'visa', status: 'active', updated_at: new Date().toISOString() },
  { _id: 'iin_524366', prefix: '524366', bank_code: 'KOTAK', bank_name: 'Kotak Mahindra Bank', card_type: 'credit', card_tier: 'platinum', card_network: 'mastercard', status: 'active', updated_at: new Date().toISOString() },
  // YES Bank
  { _id: 'iin_459153', prefix: '459153', bank_code: 'YESBANK', bank_name: 'YES Bank', card_type: 'credit', card_tier: 'platinum', card_network: 'visa', status: 'active', updated_at: new Date().toISOString() },
  { _id: 'iin_541315', prefix: '541315', bank_code: 'YESBANK', bank_name: 'YES Bank', card_type: 'credit', card_tier: 'standard', card_network: 'mastercard', status: 'active', updated_at: new Date().toISOString() },
  // IDBI
  { _id: 'iin_455100', prefix: '455100', bank_code: 'IDBI', bank_name: 'IDBI Bank', card_type: 'credit', card_tier: 'platinum', card_network: 'visa', status: 'active', updated_at: new Date().toISOString() },
];

const SAMPLE_CAMPAIGNS = [
  {
    _id: 'camp_hdfc_premium_july',
    code: 'HDFC-PREMIUM-JULY',
    title: 'HDFC Premium No-Cost EMI',
    scope: 'merchant',
    merchant_id: 'merch_demo',
    brand: null,
    bank: 'HDFC',
    iin_prefixes: ['459130', '459131', '459132'],
    card_tiers: ['platinum', 'signature', 'infinite'],
    emi_type: 'no_cost',
    products: null,
    max_total: 100,
    max_per_merchant: null,
    max_per_card: 2,
    subsidy_amount: null,
    requires_imei: false,
    starts_at: '2026-07-01T00:00:00.000Z',
    ends_at: '2026-12-31T23:59:59.000Z',
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    _id: 'camp_samsung_s24_brand',
    code: 'SAMSUNG-S24-BRAND',
    title: 'Samsung S24 No-Cost EMI (All Merchants)',
    scope: 'brand',
    merchant_id: null,
    brand: 'Samsung',
    bank: 'HDFC',
    iin_prefixes: ['459130', '459131', '437450'],
    card_tiers: ['platinum', 'signature', 'standard'],
    emi_type: 'no_cost',
    products: ['SKU-S24', 'SKU-S24U'],
    max_total: 500,
    max_per_merchant: 50,
    max_per_card: 1,
    subsidy_amount: null,
    requires_imei: true,
    starts_at: '2026-07-01T00:00:00.000Z',
    ends_at: '2026-09-30T23:59:59.000Z',
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

async function seed() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);

  console.log('Connected to MongoDB, seeding IIN ranges + EMI campaigns...');

  await db.collection('iin_ranges').deleteMany({});
  await db.collection('emi_campaigns').deleteMany({});
  await db.collection('emi_redemptions').deleteMany({});

  await db.collection('iin_ranges').insertMany(IIN_RANGES);
  console.log(`Seeded ${IIN_RANGES.length} IIN ranges`);

  await db.collection('emi_campaigns').insertMany(SAMPLE_CAMPAIGNS);
  console.log(`Seeded ${SAMPLE_CAMPAIGNS.length} EMI campaigns`);

  await client.close();
  console.log('Done!');
}

seed().catch(console.error);
```

- [ ] **Step 2: Run the seed script**

Run: `npx tsx scripts/seed-iin.ts`
Expected: "Seeded 26 IIN ranges" + "Seeded 2 EMI campaigns"

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-iin.ts
git commit -m "feat(checkout): seed IIN ranges and sample EMI campaigns"
```

---

## Task 10: Run Full Test Suite + Type Check

- [ ] **Step 1: Run all tests**

Run: `npx jest --no-coverage`
Expected: All existing tests + 21 new tests pass (10 IIN + 11 campaign)

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: resolve type errors from EMI campaign engine integration"
```
