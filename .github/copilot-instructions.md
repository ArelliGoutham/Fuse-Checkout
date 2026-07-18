# OfferForge — Engineering Practices for Copilot

These practices are mandatory for all code in this repository. Follow them on every change.

---

## Core Principles

### DRY (Don't Repeat Yourself)
- Never duplicate logic. If the same rule, validation, or transformation appears in two places, extract it into a shared function/module.
- Shared utilities live in `src/lib/` or `src/shared/` — import from there, never copy-paste.
- If you find yourself writing similar code twice, stop and extract first.

### SOLID Principles
- **Single Responsibility**: Each module/function/class does one thing. If a function validates AND transforms AND persists, split it.
- **Open/Closed**: Open for extension, closed for modification. The `OfferEvaluatorRegistry` is the canonical example — new offer types are added by registering a new evaluator, not by modifying existing evaluators.
- **Liskov Substitution**: Any `OfferEvaluator` implementation must work wherever the interface is expected. Never add type-specific hacks in the registry. Same applies to module service interfaces — any implementation (in-process or remote adapter) must be substitutable.
- **Interface Segregation**: Don't force implementations to depend on methods they don't use. Keep interfaces minimal. Each module exposes only the methods its consumers need.
- **Dependency Inversion**: Depend on abstractions (interfaces), not concrete classes. Inject dependencies via constructor or function params at the composition root (`app.ts`). This is critical for the modular monolith → microservice extraction path — see "Modular Monolith" section below.

---

## Validation

### Zod for Validation

**Use Zod everywhere for validation** — both API input and internal data boundaries.

- **API endpoints**: Define a Zod schema for every request body, query params, and response. Use Fastify's Zod integration or manual `schema.parse()` in the preHandler.
  ```typescript
  const ValidateOfferSchema = z.object({
    code: z.string().min(1).max(50),
    cart: z.object({
      amount: z.number().positive(),
      items: z.array(z.object({
        sku_id: z.string(),
        category: z.string().optional(),
        brand: z.string().optional(),
        price: z.number().positive(),
        qty: z.number().int().positive(),
      })),
    }),
    customer: z.object({
      email: z.string().email().optional(),
      phone: z.string().optional(),
      external_id: z.string().optional(),
    }).optional(),
  });

  // In route handler:
  const parsed = ValidateOfferSchema.parse(request.body); // throws ZodError on invalid
  ```
- **Internal boundaries**: When data crosses a module boundary (e.g., rule engine receives context), validate with Zod at the boundary. Internal helpers can trust validated data.
- **Infer types from Zod schemas** — never define a type and a schema separately. Use `z.infer<typeof Schema>` to derive the TypeScript type:
  ```typescript
  const OfferSchema = z.object({ ... });
  type Offer = z.infer<typeof OfferSchema>;  // single source of truth
  ```
- **Error formatting**: Catch `ZodError` and return `400 VALIDATION_ERROR` with `error.details` containing `zodError.flatten()` for field-level messages.
- **Reusable schemas**: Shared schemas (Cart, Customer, Discount) live in `src/modules/<module>/schemas.ts` and are imported by route handlers and other modules.

### Input Validation — Always
- Every API endpoint MUST validate its input using Zod schemas.
- Never trust incoming data — validate type, format, range, and presence before processing.
- Validation errors return `400 VALIDATION_ERROR` with a clear message indicating which field failed.
- Internal function boundaries: validate arguments at public API boundaries using Zod. Internal helpers can trust their callers if the call site validated.

### Output Validation
- API responses follow the documented response shape. Use TypeScript types/interfaces to enforce.
- Never leak internal fields (e.g., MongoDB `_id` should be mapped to `id` in API responses unless the endpoint specifically requires `_id`).

---

## Error Handling

- Never swallow errors. A `catch` block that does nothing is a bug.
- Use the error envelope: `{ error: { code, message, details? } }` — defined in the PRD.
- Throw typed errors, not bare strings: `throw new OfferNotFoundError(code)` not `throw "not found"`.
- Log errors with context (which endpoint, which merchant, which offer) — never log secrets or PII.
- Database operations must handle connection errors gracefully — retry or fail fast, never hang.

---

## TypeScript & Types

### Strict Mode
- `strict: true` in `tsconfig.json` — no exceptions.
- No `any` types. If you genuinely don't know the type, use `unknown` and narrow it.
- No `as` type assertions unless there's a clear reason in a comment. Prefer type guards.

### TSDoc Comments
- All exported functions, classes, interfaces, and types MUST have TSDoc comments.
- TSDoc format:
  ```typescript
  /**
   * Evaluates an offer against the given cart and customer context.
   * Checks all rules in order; returns the first failing rule as the reason.
   *
   * @param offer - The offer to evaluate (must have rules array)
   * @param context - Cart, customer, merchant, and usage data
   * @returns Evaluation result with eligibility, discount, and failure reason
   *
   * @example
   * const result = CouponEvaluator.evaluate(offer, context);
   * if (!result.eligible) console.log(result.reason);
   */
  export function evaluate(offer: Offer, context: EvaluationContext): EvaluationResult
  ```
- Non-exported functions: add TSDoc if logic is non-obvious. Trivial one-liners can skip it.
- Types and interfaces: document what they represent, not just their fields.

### Naming Conventions
- **Files**: `camelCase.ts` for utilities, `PascalCase.ts` for classes/components, `kebab-case` for route files.
- **Functions/variables**: `camelCase`
- **Classes/interfaces/types**: `PascalCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Enums**: `PascalCase` for enum, `PascalCase` for members (e.g., `OfferStatus.Active`)

---

## Test-Driven Development (TDD)

### TDD Is Mandatory
- **Red-Green-Refactor**: Write a failing test first, write the minimum code to pass it, then refactor.
- Never write implementation before a test exists for that behavior.
- This applies to all logic: rule evaluators, combo resolver, API endpoints, utilities, services.

### TDD Workflow
1. **Write the test** — describe the behavior you want. Run it. It fails (red).
2. **Write minimal code** — just enough to pass the test. Run it. It passes (green).
3. **Refactor** — improve the code without changing behavior. Run tests again. Still green.
4. **Repeat** — add the next behavior test, fail, pass, refactor.

### TDD for Rule Evaluators (Example)
```typescript
// 1. Write test first — rule/min-cart-value.test.ts
describe('minCartValue rule', () => {
  it('returns true when cart amount equals min_amount (boundary)', () => {
    const rule = { min_amount: 500 };
    const context = { cart: { amount: 500, items: [] } };
    expect(minCartValue(rule, context)).toBe(true);
  });

  it('returns false when cart amount is below min_amount', () => {
    const rule = { min_amount: 500 };
    const context = { cart: { amount: 499, items: [] } };
    expect(minCartValue(rule, context)).toBe(false);
  });

  it('returns true when cart amount exceeds min_amount', () => {
    const rule = { min_amount: 500 };
    const context = { cart: { amount: 501, items: [] } };
    expect(minCartValue(rule, context)).toBe(true);
  });
});

// 2. Write minimal implementation — rule/min-cart-value.ts
/**
 * Checks if the cart total meets the minimum amount threshold.
 * @param rule - Config with min_amount
 * @param context - Evaluation context containing cart data
 * @returns true if cart.amount >= rule.min_amount
 */
export function minCartValue(rule: { min_amount: number }, context: EvaluationContext): boolean {
  return context.cart.amount >= rule.min_amount;
}

// 3. Refactor — extract shared types, no behavior change
```

### TDD for API Endpoints
1. Write a test that calls the endpoint with valid input → expect 200 with correct shape.
2. Implement the route handler to pass.
3. Write a test for invalid input → expect 400 VALIDATION_ERROR.
4. Add Zod validation to pass.
4. Write a test for auth failure → expect 401.
5. Add auth middleware.
6. Write a test for tenant isolation → expect 404 for cross-merchant ID.
7. Add merchant_id scoping.

### Test Data
- Use **factories** for test data, not hardcoded objects repeated across tests:
  ```typescript
  // test/factories/offer.factory.ts
  export function createOffer(overrides: Partial<Offer> = {}): Offer {
    return {
      merchant_id: 'merch_test',
      code: 'TEST50',
      type: 'coupon',
      discount: { type: 'flat', value: 50, max_discount: null },
      ...
      ...overrides,
    };
  }
  ```
- Factories ensure tests don't break when schema evolves — change the factory, not every test.
- Mock external dependencies (MongoDB, Redis) at the module boundary using `jest.mock()`. Prefer integration tests with a real MongoDB connection when feasible (use `mongodb-memory-server` for local tests).

### What to Test
- **Rule evaluators** (pure functions): every rule type gets test cases for pass, fail, and edge cases (boundary values, empty input, null handling).
- **Combo resolver**: single offer, stacking, exclusive offers, global limits, per-offer overrides, discount cap.
- **API endpoints**: integration tests covering the full request→response cycle, including auth, validation, and error cases.
- **Tenant isolation**: every endpoint that accepts an ID must have a test confirming merchant A cannot access merchant B's data.

### Test Structure
- Tests live next to the source file: `evaluate.ts` → `evaluate.test.ts` (colocated), OR in a `__tests__/` directory if you prefer — pick one and be consistent.
- Test names describe behavior: `("returns ineligible when cart amount is below min_cart_value rule")` not `("test rule 1")`.
- Use describe/it blocks to group by feature/rule type.
- Each test has three phases: setup (arrange) → act → assert. Prefer explicit over clever.

### Coverage Expectations
- Rule engine: 90%+ coverage — this is the core logic, bugs here mean wrong discounts.
- API layer: 80%+ — cover happy path, validation errors, auth failures, and tenant isolation.
- Dashboard: minimal unit tests for utility functions; UI components may skip tests in v1.

### Framework
- **Jest** for unit and integration tests.
- **Superagent** or Fastify's `inject()` for API integration tests (no need for a running server).
- Run tests: `npm test` (or `npm run test:unit` / `npm run test:integration` if split).

---

## Branding & Configuration

### No Hardcoded Brand Name
- The product name "OfferForge" is **not hardcoded** in any user-facing string, email, dashboard title, API response, or documentation template.
- The brand name is a single configuration value: `BRAND_NAME` environment variable (or `config.brandName` in app config).
- All user-facing strings reference the config value, not a literal string.

```typescript
// ✅ CORRECT — brand name from config
const appName = config.brandName; // "OfferForge" today, could be "OfferHub" tomorrow
res.send({ message: `Welcome to ${appName}` });

// ❌ WRONG — hardcoded brand string
res.send({ message: 'Welcome to OfferForge' });
```

### Where Brand Name Appears
- Dashboard UI (header, login page, emails)
- API documentation (OpenAPI title, description)
- Error messages that reference the product ("OfferForge API key required")
- Email templates (if any in v1)
- Future widget branding (white-label-ready by design)

### Single Source of Truth
```typescript
// src/config/index.ts
export const config = {
  brandName: process.env.BRAND_NAME || 'OfferForge',
  // ... other config
};
```

- One place to change the brand name: the `BRAND_NAME` env var.
- Default fallback is "OfferForge" — but every reference reads from config, not from the literal.
- When the domain is finalized, set `BRAND_NAME=NewName` in deploy config. Zero code changes.

### Also Configurable
- `BRAND_LOGO_URL` — logo image URL
- `BRAND_PRIMARY_COLOR` — primary brand color for dashboard
- `BRAND_SUPPORT_EMAIL` — support contact
- `BRAND_DOMAIN` — base domain for API and dashboard URLs

All brand-related values live in the config module and are referenced via config, never hardcoded.

---

## Code Structure & Modularity

### Architecture: Modular Monolith

OfferForge is a **modular monolith** — a single deployable unit with strict module boundaries. Each module (offers, products, customers, analytics, tracking) is self-contained with its own routes, services, models, and types. Modules communicate **through interfaces only, never concrete implementations** — because we may extract modules into separate microservices later.

### Interface-Only Communication

- Every module exports **interfaces** (TypeScript interfaces), not concrete classes.
- Cross-module calls go through the interface, with the concrete implementation injected at the composition root (`app.ts`).
- Never `import { ConcreteService } from '../other-module/service'` — import the interface and accept it as a dependency.

```typescript
// ✅ CORRECT — depend on interface, inject implementation
import type { OfferService } from '../offers/types';

// In module that needs offers:
class CheckoutHandler {
  constructor(private offerService: OfferService) {}  // interface, not concrete
  async applyOffer(req) {
    return this.offerService.validateAndApply(req);  // calls interface method
  }
}

// Composition root (src/app.ts) wires concrete → interface
const offerService = new ConcreteOfferService(db);
const checkoutHandler = new CheckoutHandler(offerService);

// ❌ WRONG — depends on concrete implementation
import { ConcreteOfferService } from '../offers/services/offer-service';  // coupling!
```

### Why Interface-Only

- **Microservice-ready**: When we extract `offers` into a separate service, the interface stays the same — other modules switch from in-process call to HTTP/gRPC call via a new adapter that implements the same interface. Zero changes to consuming modules.
- **Testability**: Mock the interface in unit tests. No need to mock internal dependencies of a concrete class.
- **Substitution**: Swap implementations (e.g., caching layer, different storage) without touching consumers.

### Module Interface Contract

Each module defines its public interface in `types/index.ts`:

```typescript
// src/modules/offers/types/index.ts
export interface OfferService {
  createOffer(input: CreateOfferInput): Promise<Offer>;
  getOffers(query: OfferQuery): Promise<Offer[]>;
  validateOffer(input: ValidateInput): Promise<ValidationResult>;
  applyOffer(input: ApplyInput): Promise<ApplyResult>;
}

export interface OfferRepository {
  findById(id: string, merchantId: string): Promise<Offer | null>;
  findByCode(code: string, merchantId: string): Promise<Offer | null>;
  // ... data access methods
}
```

- `Service` interfaces define business operations (what the module does).
- `Repository` interfaces define data access (how the module persists).
- Concrete implementations live in `services/` and `repositories/` — never exported outside the module.
- The module's `index.ts` exports only interfaces and types — the public contract.

### Module Boundary Rules

- **No cross-module internal imports**: `import { something } from '../offers/services/concrete-service'` is forbidden. Only import from `../offers/types` or `../offers/index`.
- **No shared database access**: Module A never queries module B's collection directly. If A needs B's data, it calls B's service interface.
- **No shared internal utilities**: Shared utilities go in `src/lib/` and are imported by all. Module-specific utilities stay inside the module.
- **Events for async communication**: If modules need to react to each other's actions (e.g., tracking module reacts to offer applied), use an internal event bus. The publisher doesn't know who listens — same decoupling principle.

### Microservice Extraction Path

When a module is extracted to a microservice:
1. The interface stays unchanged.
2. A new **adapter** implements the interface and makes HTTP/gRPC calls to the new service.
3. The composition root swaps the in-process implementation for the adapter.
4. Consuming modules are unchanged — they still call the same interface methods.

```
Before (modular monolith):
  Module A → OfferService (interface) → ConcreteOfferService (in-process)

After (microservice):
  Module A → OfferService (interface) → RemoteOfferServiceAdapter (HTTP) → [Offer Microservice]
```

### File Organization
```
src/
  config/          — environment, database, app config
  lib/             — shared utilities (validation helpers, formatters)
  middleware/      — Fastify middleware (auth, rate limiting, error handling)
  modules/
    offers/        — offer CRUD, rule engine, evaluators, combo resolver
      types/         — OfferService, OfferRepository interfaces (PUBLIC CONTRACT)
      evaluators/    — CouponEvaluator, AutoOfferEvaluator, OfferEvaluatorRegistry
      rules/         — individual rule evaluator functions
      combo/         — ComboResolver
      services/      — ConcreteOfferService (implements OfferService)
      repositories/  — MongoOfferRepository (implements OfferRepository)
      routes/        — Fastify route handlers
      schemas/       — Zod schemas for this module
      index.ts       — exports only interfaces and types
    products/      — product catalog + combos (same structure)
    customers/     — global customer, merchant_customer, customer_offers
    analytics/     — redemption aggregation, metrics
    tracking/      — conversion tracking
  app.ts           — composition root: wire concrete implementations to interfaces
```

---

## Linting & Formatting

### ESLint
- Use `@typescript-eslint` plugin with strict rules.
- **No unused variables** (`@typescript-eslint/no-unused-vars` — error, not warning).
- **No explicit any** (`@typescript-eslint/no-explicit-any` — error).
- **Prefer const** (`prefer-const` — error).
- **No floating promises** (`@typescript-eslint/no-floating-promises` — error).
- Run: `npm run lint`

### Prettier
- Format on save. Config: single quotes, trailing commas (all), 80 char print width, 2-space indent.
- Run: `npm run format`

### Pre-commit
- Lint + type-check + test must pass before commit.
- Use Husky + lint-staged: `npm run prepare` sets up hooks.

---

## Database (MongoDB)

### Query Patterns
- Always scope queries by `merchant_id` — no exceptions. This is the tenant isolation invariant.
- Use indexes — never run a query that isn't backed by an index in production. Check `explain()` if unsure.
- Avoid `$where` and large `$in` arrays. If you need a complex query, add an index for it.
- Pagination: use cursor-based (`_id > last_id` with limit), not `skip()` — skip is O(n).

### Schema Discipline
- Use Mongoose schemas (or a similar ODM) to enforce document shape — don't store unvalidated JSON.
- Timestamps: `createdAt` and `updatedAt` on every collection (Mongoose handles automatically).
- Never store passwords or API keys in plaintext — hash with bcrypt.

---

## Git Practices

### Commit Messages
- Format: `type(scope): description` where type is `feat`, `fix`, `docs`, `refactor`, `test`, `chore`.
- Examples: `feat(offers): add CouponEvaluator`, `fix(combo): respect exclusive flag before sorting`, `docs: update PRD with banking module notes`
- Keep commits atomic — one logical change per commit.

### Branch Naming
- `feature/<short-description>` (e.g., `feature/rule-engine`)
- `fix/<short-description>` (e.g., `fix/per-customer-limit-race`)
- `chore/<short-description>` (e.g., `chore/setup-linting`)

---

## Review Checklist (Before Committing)

- [ ] **Tests written first (TDD)** — failing test → implementation → green
- [ ] **Zod schemas** for all API inputs and module boundaries
- [ ] **No hardcoded brand name** — all references use `config.brandName`, not the literal "OfferForge"
- [ ] **Modular monolith** — cross-module imports are interfaces only, no concrete classes
- [ ] No `any` types — all types are explicit
- [ ] All exported functions have TSDoc comments
- [ ] Tests written and passing for new logic
- [ ] No duplicated code — DRY
- [ ] Queries scoped by `merchant_id`
- [ ] Error handling uses the error envelope
- [ ] Lint passes (`npm run lint`)
- [ ] Type check passes (`npm run typecheck`)
- [ ] No secrets hardcoded — use environment variables
- [ ] Types inferred from Zod schemas (`z.infer<typeof Schema>`) — no dual definitions

---

## Don'ts

- **Don't** write implementation before a test (TDD — red first, always)
- **Don't** hardcode the brand name "OfferForge" in any string — use `config.brandName` (env var `BRAND_NAME`)
- **Don't** use `any` — use `unknown` and narrow
- **Don't** define types and Zod schemas separately — use `z.infer<typeof Schema>`
- **Don't** skip validation because "it's an internal call"
- **Don't** write a function without tests for its core logic
- **Don't** duplicate a rule, utility, or transformation — extract it
- **Don't** reach into another module's internals — use its public interface only (modular monolith invariant)
- **Don't** import concrete classes across module boundaries — import interfaces, inject implementations at the composition root
- **Don't** store plaintext secrets
- **Don't** leave `console.log` in committed code — use a logger
- **Don't** hardcode config values — use environment variables
- **Don't** add dependencies without checking if a stdlib or existing dep can do it
- **Don't** use JSON schema (Fastify built-in) when Zod is the standard for this project
