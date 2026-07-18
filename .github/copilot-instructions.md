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
- **Liskov Substitution**: Any `OfferEvaluator` implementation must work wherever the interface is expected. Never add type-specific hacks in the registry.
- **Interface Segregation**: Don't force implementations to depend on methods they don't use. Keep interfaces minimal.
- **Dependency Inversion**: Depend on abstractions, not concrete classes. Inject dependencies (database connections, evaluators) via constructor or function params — never `require()` a concrete dependency directly inside business logic.

---

## Validation

### Input Validation — Always
- Every API endpoint MUST validate its input using a JSON schema (Fastify schema validation or Zod).
- Never trust incoming data — validate type, format, range, and presence before processing.
- Validation errors return `400 VALIDATION_ERROR` with a clear message indicating which field failed.
- Internal function boundaries: validate arguments at public API boundaries. Internal helpers can trust their callers if the call site validated.

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

## Testing

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

## Code Structure & Modularity

### File Organization
```
src/
  config/          — environment, database, app config
  lib/             — shared utilities (validation helpers, formatters)
  middleware/      — Fastify middleware (auth, rate limiting, error handling)
  modules/
    offers/        — offer CRUD, rule engine, evaluators, combo resolver
      evaluators/    — CouponEvaluator, AutoOfferEvaluator, OfferEvaluatorRegistry
      rules/         — individual rule evaluator functions
      combo/         — ComboResolver
      routes/        — Fastify route handlers
      models/        — MongoDB schemas/queries
      types/         — Offer, EvaluationContext, EvaluationResult types
    products/      — product catalog + combos
    customers/     — global customer, merchant_customer, customer_offers
    analytics/     — redemption aggregation, metrics
    tracking/      — conversion tracking
  app.ts           — Fastify server setup
```

### Module Boundaries
- Modules communicate through their exported interfaces only — never reach into another module's internal files.
- Cross-module data access goes through the module's service layer, not directly to the database.
- If module A needs module B's data, it imports B's service function, not B's model.

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

- [ ] No `any` types — all types are explicit
- [ ] All exported functions have TSDoc comments
- [ ] Input validation on every API endpoint
- [ ] Tests written and passing for new logic
- [ ] No duplicated code — DRY
- [ ] Queries scoped by `merchant_id`
- [ ] Error handling uses the error envelope
- [ ] Lint passes (`npm run lint`)
- [ ] Type check passes (`npm run typecheck`)
- [ ] No secrets hardcoded — use environment variables

---

## Don'ts

- **Don't** use `any` — use `unknown` and narrow
- **Don't** skip validation because "it's an internal call"
- **Don't** write a function without tests for its core logic
- **Don't** duplicate a rule, utility, or transformation — extract it
- **Don't** reach into another module's internals — use its public interface
- **Don't** store plaintext secrets
- **Don't** leave `console.log` in committed code — use a logger
- **Don't** hardcode config values — use environment variables
- **Don't** add dependencies without checking if a stdlib or existing dep can do it
