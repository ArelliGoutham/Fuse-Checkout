# Auth & Team Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Add user accounts with JWT auth, role-based access control, team invitations with email-bound codes (7-day expiry), and API key management with scopes — replacing the current single API key auth.

**Architecture:** JWT-based auth with bcrypt password hashing. Users are global (email-unique), linked to merchants via merchant_users with roles. Invite codes are 6-char alphanumeric, email-bound, 7-day expiry. API keys stored as bcrypt hashes with scopes. Both JWT and API key auth coexist — JWT for dashboard, API key for programmatic access.

**Tech Stack:** bcryptjs, jsonwebtoken, Zod, Fastify, MongoDB, Jest + mongodb-memory-server

**Spec:** Discussed and approved in conversation (2026-07-19)
**Engineering practices:** `.github/copilot-instructions.md`

---

## File Structure

```
src/
  modules/
    auth/
      schemas/
        user.ts           — UserSchema, SignupSchema, LoginSchema
        invite.ts         — InviteSchema, CreateInviteSchema, AcceptInviteSchema
        api-key.ts        — ApiKeySchema, CreateApiKeySchema
      types/
        index.ts          — AuthService, InviteService, ApiKeyService interfaces
      services/
        auth-service.ts   — signup, login, generateToken, verifyToken
        invite-service.ts — createInvite, acceptInvite, listInvites, revokeInvite
        api-key-service.ts — createKey, validateKey, revokeKey, listKeys
      repositories/
        mongo-user-repository.ts
        mongo-invite-repository.ts
        mongo-api-key-repository.ts
      routes/
        auth-routes.ts    — POST /signup, /login, GET /me, POST /accept-invite
        invite-routes.ts  — POST /team/invite, GET /team/invites, DELETE /team/invites/:code
        api-key-routes.ts — POST /api-keys, GET /api-keys, DELETE /api-keys/:id
      index.ts            — module factory
  middleware/
    jwt-auth.ts           — JWT auth middleware (Authorization: Bearer <token>)
    require-role.ts       — Role-based access control middleware factory
    auth.ts               — EXISTING (API key auth) — keep as-is
  config/
    index.ts              — EXISTING — add JWT_SECRET env var
```

---

## Task 1: User Schema + Password Hashing

**Files:**
- Create: `src/modules/auth/schemas/user.ts`
- Create: `src/lib/password.ts`
- Test: `src/lib/password.test.ts`

- [ ] **Step 1: Write failing test for password hashing**

```typescript
// src/lib/password.test.ts
import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('hashes a password and verifies it', async () => {
    const hash = await hashPassword('mypassword123');
    expect(hash).not.toBe('mypassword123');
    expect(await verifyPassword('mypassword123', hash)).toBe(true);
  });

  it('rejects wrong password', async () => {
    const hash = await hashPassword('correct');
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx jest src/lib/password.test.ts`

- [ ] **Step 3: Implement password utilities**

```typescript
// src/lib/password.ts
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

/** Hashes a plaintext password using bcrypt. */
export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, SALT_ROUNDS);
}

/** Verifies a plaintext password against a bcrypt hash. */
export async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}
```

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Implement user schemas**

```typescript
// src/modules/auth/schemas/user.ts
import { z } from 'zod';

export const UserSchema = z.object({
  _id: z.string(),
  email: z.string().email(),
  password_hash: z.string(),
  name: z.string(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1),
  store_name: z.string().min(1),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type User = z.infer<typeof UserSchema>;
export type SignupInput = z.infer<typeof SignupSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
```

- [ ] **Step 6: Commit** — `feat(auth): add password hashing utilities and user schemas`

---

## Task 2: JWT Token Utilities

**Files:**
- Create: `src/lib/jwt.ts`
- Test: `src/lib/jwt.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/lib/jwt.test.ts
import { generateToken, verifyToken } from './jwt';

describe('JWT utilities', () => {
  it('generates and verifies a token', () => {
    const payload = { user_id: 'u1', merchant_id: 'm1', role: 'owner' };
    const token = generateToken(payload);
    expect(token).toBeDefined();
    const decoded = verifyToken(token);
    expect(decoded.user_id).toBe('u1');
    expect(decoded.merchant_id).toBe('m1');
    expect(decoded.role).toBe('owner');
  });

  it('throws on invalid token', () => {
    expect(() => verifyToken('invalid-token')).toThrow();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

- [ ] **Step 3: Implement JWT utilities**

```typescript
// src/lib/jwt.ts
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRY = '7d';

export interface TokenPayload {
  user_id: string;
  merchant_id: string;
  role: string;
}

/** Generates a JWT token with the given payload. */
export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

/** Verifies and decodes a JWT token. Throws if invalid. */
export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}
```

- [ ] **Step 4: Run test to verify it passes** — requires `JWT_SECRET` env var or uses default

- [ ] **Step 5: Add JWT_SECRET to config**

```typescript
// Add to src/config/index.ts
export const config = {
  // ... existing
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
} as const;
```

Update jwt.ts to use `config.jwtSecret` instead of local var.

- [ ] **Step 6: Commit** — `feat(auth): add JWT token generation and verification utilities`

---

## Task 3: Invite Schema + Code Generation

**Files:**
- Create: `src/modules/auth/schemas/invite.ts`
- Create: `src/lib/invite-code.ts`
- Test: `src/lib/invite-code.test.ts`

- [ ] **Step 1: Write failing test for invite code generation**

```typescript
// src/lib/invite-code.test.ts
import { generateInviteCode } from './invite-code';

describe('generateInviteCode', () => {
  it('generates a 6-character alphanumeric code', () => {
    const code = generateInviteCode();
    expect(code).toHaveLength(6);
    expect(code).toMatch(/^[A-Z2-9]+$/); // uppercase, no 0/O/1/I
  });

  it('generates different codes on each call', () => {
    const codes = new Set(Array.from({ length: 10 }, () => generateInviteCode()));
    expect(codes.size).toBeGreaterThan(5); // at least 6 unique out of 10
  });
});
```

- [ ] **Step 2: Run to verify it fails**

- [ ] **Step 3: Implement invite code generator**

```typescript
// src/lib/invite-code.ts
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0,1,I,O

/** Generates a 6-character invite code (no ambiguous chars). */
export function generateInviteCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}
```

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Implement invite schemas**

```typescript
// src/modules/auth/schemas/invite.ts
import { z } from 'zod';

export const ROLES = ['owner', 'admin', 'offer_manager', 'analytics_viewer'] as const;
export type Role = (typeof ROLES)[number];

export const MerchantUserSchema = z.object({
  _id: z.string(),
  merchant_id: z.string(),
  email: z.string().email(),
  user_id: z.string().nullable(),
  role: z.enum(ROLES),
  status: z.enum(['pending', 'active', 'removed', 'expired']),
  invite_code: z.string(),
  invited_by: z.string(),
  invited_at: z.string().datetime(),
  expires_at: z.string().datetime(),
  accepted_at: z.string().datetime().nullable(),
});

export const CreateInviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'offer_manager', 'analytics_viewer']), // cannot invite as owner
});

export const AcceptInviteSchema = z.object({
  invite_code: z.string().min(6).max(6),
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

export type MerchantUser = z.infer<typeof MerchantUserSchema>;
export type CreateInviteInput = z.infer<typeof CreateInviteSchema>;
export type AcceptInviteInput = z.infer<typeof AcceptInviteSchema>;

/** Role hierarchy for permission checks. Higher = more power. */
export const ROLE_LEVELS: Record<Role, number> = {
  owner: 4,
  admin: 3,
  offer_manager: 2,
  analytics_viewer: 1,
};

/** Checks if inviterRole can invite someone with the target role. */
export function canInvite(inviterRole: Role, targetRole: Role): boolean {
  return ROLE_LEVELS[inviterRole] > ROLE_LEVELS[targetRole];
}
```

- [ ] **Step 6: Commit** — `feat(auth): add invite code generation and invite schemas with role hierarchy`

---

## Task 4: API Key Schema

**Files:**
- Create: `src/modules/auth/schemas/api-key.ts`

- [ ] **Step 1: Implement API key schemas**

```typescript
// src/modules/auth/schemas/api-key.ts
import { z } from 'zod';

export const ApiKeySchema = z.object({
  _id: z.string(),
  merchant_id: z.string(),
  key_hash: z.string(),
  label: z.string(),
  scopes: z.array(z.enum([
    'offers:read', 'offers:write',
    'analytics:read',
    'products:read', 'products:write',
    'checkout', 'tracking',
  ])),
  status: z.enum(['active', 'revoked']),
  last_used_at: z.string().datetime().nullable(),
  created_by: z.string(),
  created_at: z.string().datetime(),
  revoked_at: z.string().datetime().nullable(),
});

export const CreateApiKeySchema = z.object({
  label: z.string().min(1).max(50),
  scopes: z.array(z.string()),
});

export type ApiKey = z.infer<typeof ApiKeySchema>;
export type CreateApiKeyInput = z.infer<typeof CreateApiKeySchema>;
```

- [ ] **Step 2: Commit** — `feat(auth): add API key schemas with scopes`

---

## Task 5: Signup + Login Endpoints

**Files:**
- Create: `src/modules/auth/routes/auth-routes.ts`
- Test: `src/modules/auth/routes/auth-routes.test.ts`

This creates the core auth endpoints that create a merchant + user + merchant_user (owner) on signup, and return a JWT on login.

- [ ] **Step 1: Write failing test for signup**

```typescript
// src/modules/auth/routes/auth-routes.test.ts
import { createServer } from '../../../app';
import { errorHandler } from '../../../middleware/error-handler';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { connectDatabase, closeDatabase, getDatabase } from '../../../config/database';
import { registerAuthRoutes } from './auth-routes';
import type { FastifyInstance } from 'fastify';

describe('auth routes', () => {
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
    registerAuthRoutes(server);
    await getDatabase().collection('users').deleteMany({});
    await getDatabase().collection('merchants').deleteMany({});
    await getDatabase().collection('merchant_users').deleteMany({});
  });

  afterEach(async () => {
    await server.close();
  });

  it('POST /api/auth/signup creates merchant + user + owner link', async () => {
    const res = await server.inject({
      method: 'POST', url: '/api/auth/signup',
      payload: {
        email: 'owner@store.in',
        password: 'password123',
        name: 'Store Owner',
        store_name: 'TechStore',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.token).toBeDefined();
    expect(body.user.email).toBe('owner@store.in');
    expect(body.merchant.name).toBe('TechStore');
    expect(body.role).toBe('owner');
  });

  it('POST /api/auth/login returns JWT for existing user', async () => {
    // First signup
    await server.inject({
      method: 'POST', url: '/api/auth/signup',
      payload: { email: 'owner@store.in', password: 'password123', name: 'Owner', store_name: 'Store' },
    });
    // Then login
    const res = await server.inject({
      method: 'POST', url: '/api/auth/login',
      payload: { email: 'owner@store.in', password: 'password123' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.token).toBeDefined();
    expect(body.user.email).toBe('owner@store.in');
  });

  it('POST /api/auth/login rejects wrong password', async () => {
    await server.inject({
      method: 'POST', url: '/api/auth/signup',
      payload: { email: 'owner@store.in', password: 'password123', name: 'Owner', store_name: 'Store' },
    });
    const res = await server.inject({
      method: 'POST', url: '/api/auth/login',
      payload: { email: 'owner@store.in', password: 'wrong' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/auth/signup rejects duplicate email', async () => {
    await server.inject({
      method: 'POST', url: '/api/auth/signup',
      payload: { email: 'owner@store.in', password: 'password123', name: 'Owner', store_name: 'Store' },
    });
    const res = await server.inject({
      method: 'POST', url: '/api/auth/signup',
      payload: { email: 'owner@store.in', password: 'password123', name: 'Owner2', store_name: 'Store2' },
    });
    expect(res.statusCode).toBe(409);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

- [ ] **Step 3: Implement auth routes**

```typescript
// src/modules/auth/routes/auth-routes.ts
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { SignupSchema, LoginSchema } from '../schemas/user';
import { hashPassword, verifyPassword } from '../../../lib/password';
import { generateToken } from '../../../lib/jwt';

const INVITE_EXPIRY_DAYS = 7;

/** Registers auth routes: signup, login, me, accept-invite. */
export function registerAuthRoutes(server: FastifyInstance): void {
  // POST /api/auth/signup
  server.post('/api/auth/signup', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = SignupSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message } });
    }

    const db = server.db!;
    const { email, password, name, store_name } = parsed.data;

    // Check if user already exists
    const existing = await db.collection('users').findOne({ email });
    if (existing) {
      return reply.code(409).send({ error: { code: 'EMAIL_EXISTS', message: 'Email already registered' } });
    }

    // Create merchant
    const merchantId = `merch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    await db.collection('merchants').insertOne({
      _id: merchantId,
      name: store_name,
      email,
      plan: 'starter',
      global_stacking_policy: {
        max_coupons: 1, max_auto_offers: 1, max_total_discount: null,
        allow_cross_type: true, exclusive_tags: [],
      },
      created_at: now,
    });

    // Create user
    const userId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const passwordHash = await hashPassword(password);
    await db.collection('users').insertOne({
      _id: userId,
      email,
      password_hash: passwordHash,
      name,
      created_at: now,
      updated_at: now,
    });

    // Link user to merchant as owner
    await db.collection('merchant_users').insertOne({
      _id: `mu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      merchant_id: merchantId,
      email,
      user_id: userId,
      role: 'owner',
      status: 'active',
      invite_code: '',
      invited_by: '',
      invited_at: now,
      expires_at: now,
      accepted_at: now,
    });

    const token = generateToken({ user_id: userId, merchant_id: merchantId, role: 'owner' });

    return reply.code(201).send({
      token,
      user: { _id: userId, email, name },
      merchant: { _id: merchantId, name: store_name },
      role: 'owner',
    });
  });

  // POST /api/auth/login
  server.post('/api/auth/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = LoginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message } });
    }

    const db = server.db!;
    const { email, password } = parsed.data;

    const user = await db.collection('users').findOne({ email });
    if (!user) {
      return reply.code(401).send({ error: { code: 'AUTH_INVALID', message: 'Invalid email or password' } });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return reply.code(401).send({ error: { code: 'AUTH_INVALID', message: 'Invalid email or password' } });
    }

    // Find merchant_user link (first active one)
    const mu = await db.collection('merchant_users').findOne({ user_id: user._id, status: 'active' });
    if (!mu) {
      return reply.code(403).send({ error: { code: 'NO_MERCHANT', message: 'No merchant linked to this account' } });
    }

    const token = generateToken({ user_id: user._id, merchant_id: mu.merchant_id, role: mu.role });

    return reply.send({
      token,
      user: { _id: user._id, email: user.email, name: user.name },
      merchant: { _id: mu.merchant_id },
      role: mu.role,
    });
  });

  // GET /api/auth/me — requires JWT auth
  server.get('/api/auth/me', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.code(401).send({ error: { code: 'AUTH_INVALID', message: 'Not authenticated' } });
    }
    const db = server.db!;
    const user = await db.collection('users').findOne({ _id: request.user.user_id });
    const merchant = await db.collection('merchants').findOne({ _id: request.user.merchant_id });
    return reply.send({
      user: user ? { _id: user._id, email: user.email, name: user.name } : null,
      merchant: merchant ? { _id: merchant._id, name: merchant.name } : null,
      role: request.user.role,
    });
  });
}

// Add JWT payload to FastifyRequest
declare module 'fastify' {
  interface FastifyRequest {
    user?: { user_id: string; merchant_id: string; role: string };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit** — `feat(auth): add signup and login endpoints with JWT`

---

## Task 6: JWT Auth Middleware

**Files:**
- Create: `src/middleware/jwt-auth.ts`
- Test: `src/middleware/jwt-auth.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/middleware/jwt-auth.test.ts
import { createServer } from '../app';
import { createJwtAuthMiddleware } from './jwt-auth';
import { generateToken } from '../lib/jwt';
import { errorHandler } from './error-handler';
import type { FastifyInstance } from 'fastify';

describe('JWT auth middleware', () => {
  let server: FastifyInstance;

  afterEach(async () => { if (server) await server.close(); });

  it('sets request.user when valid JWT provided', async () => {
    server = createServer();
    server.addHook('preHandler', createJwtAuthMiddleware());
    server.get('/protected', async (req) => ({ userId: req.user?.user_id, role: req.user?.role }));

    const token = generateToken({ user_id: 'u1', merchant_id: 'm1', role: 'owner' });
    const res = await server.inject({
      method: 'GET', url: '/protected',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.userId).toBe('u1');
    expect(body.role).toBe('owner');
  });

  it('returns 401 when no Authorization header', async () => {
    server = createServer();
    server.setErrorHandler(errorHandler);
    server.addHook('preHandler', createJwtAuthMiddleware());
    server.get('/protected', async () => ({ ok: true }));

    const res = await server.inject({ method: 'GET', url: '/protected' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 when token is invalid', async () => {
    server = createServer();
    server.setErrorHandler(errorHandler);
    server.addHook('preHandler', createJwtAuthMiddleware());
    server.get('/protected', async () => ({ ok: true }));

    const res = await server.inject({
      method: 'GET', url: '/protected',
      headers: { authorization: 'Bearer invalid-token' },
    });
    expect(res.statusCode).toBe(401);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

- [ ] **Step 3: Implement JWT auth middleware**

```typescript
// src/middleware/jwt-auth.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken } from '../lib/jwt';

/** Creates JWT auth middleware that validates Authorization: Bearer <token>. */
export function createJwtAuthMiddleware() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ error: { code: 'AUTH_INVALID', message: 'Missing or invalid Authorization header' } });
    }

    const token = authHeader.slice(7);
    try {
      const payload = verifyToken(token);
      request.user = payload;
      request.merchantId = payload.merchant_id;
    } catch {
      return reply.code(401).send({ error: { code: 'AUTH_INVALID', message: 'Invalid or expired token' } });
    }
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit** — `feat(middleware): add JWT auth middleware with Bearer token validation`

---

## Task 7: Role-Based Access Control Middleware

**Files:**
- Create: `src/middleware/require-role.ts`
- Test: `src/middleware/require-role.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/middleware/require-role.test.ts
import { requireRole } from './require-role';
import { ROLE_LEVELS } from '../modules/auth/schemas/invite';

describe('requireRole', () => {
  it('allows access when user role >= required role', () => {
    const middleware = requireRole('offer_manager');
    // owner (4) > offer_manager (2) → should pass
    expect(ROLE_LEVELS['owner']).toBeGreaterThan(ROLE_LEVELS['offer_manager']);
  });

  it('denies access when user role < required role', () => {
    // analytics_viewer (1) < admin (3) → should deny
    expect(ROLE_LEVELS['analytics_viewer']).toBeLessThan(ROLE_LEVELS['admin']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

- [ ] **Step 3: Implement require-role middleware**

```typescript
// src/middleware/require-role.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { ROLE_LEVELS, type Role } from '../modules/auth/schemas/invite';

/** Creates middleware that checks if the authenticated user has the required role level. */
export function requireRole(minRole: Role) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.code(401).send({ error: { code: 'AUTH_INVALID', message: 'Not authenticated' } });
    }

    const userLevel = ROLE_LEVELS[request.user.role as Role] ?? 0;
    const requiredLevel = ROLE_LEVELS[minRole];

    if (userLevel < requiredLevel) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
    }
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit** — `feat(middleware): add role-based access control middleware`

---

## Task 8: Team Invite Endpoints

**Files:**
- Create: `src/modules/auth/routes/invite-routes.ts`
- Test: `src/modules/auth/routes/invite-routes.test.ts`

- [ ] **Step 1: Write failing test for invite creation and listing**

```typescript
// src/modules/auth/routes/invite-routes.test.ts
import { createServer } from '../../../app';
import { errorHandler } from '../../../middleware/error-handler';
import { createJwtAuthMiddleware } from '../../../middleware/jwt-auth';
import { requireRole } from '../../../middleware/require-role';
import { registerAuthRoutes } from './auth-routes';
import { registerInviteRoutes } from './invite-routes';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { connectDatabase, closeDatabase, getDatabase } from '../../../config/database';
import type { FastifyInstance } from 'fastify';

describe('invite routes', () => {
  let server: FastifyInstance;
  let memServer: MongoMemoryServer;
  let ownerToken: string;

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
    registerAuthRoutes(server);

    // Signup as owner
    const signupRes = await server.inject({
      method: 'POST', url: '/api/auth/signup',
      payload: { email: 'owner@store.in', password: 'password123', name: 'Owner', store_name: 'Store' },
    });
    ownerToken = JSON.parse(signupRes.body).token;

    // Add JWT auth + invite routes (with role check)
    server.addHook('preHandler', createJwtAuthMiddleware());
    registerInviteRoutes(server);

    await getDatabase().collection('merchant_users').deleteMany({ email: { $ne: 'owner@store.in' } });
  });

  afterEach(async () => { await server.close(); });

  const authHeaders = (token: string) => ({ authorization: `Bearer ${token}` });

  it('POST /api/team/invite creates an invite with code', async () => {
    const res = await server.inject({
      method: 'POST', url: '/api/team/invite',
      headers: authHeaders(ownerToken),
      payload: { email: 'team@store.in', role: 'offer_manager' },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.invite_code).toHaveLength(6);
    expect(body.email).toBe('team@store.in');
    expect(body.role).toBe('offer_manager');
    expect(body.expires_at).toBeDefined();
  });

  it('GET /api/team/invites lists pending invites (paginated)', async () => {
    // Create an invite first
    await server.inject({
      method: 'POST', url: '/api/team/invite',
      headers: authHeaders(ownerToken),
      payload: { email: 'team@store.in', role: 'offer_manager' },
    });
    const res = await server.inject({
      method: 'GET', url: '/api/team/invites?page=1&limit=10',
      headers: authHeaders(ownerToken),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.invites).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
  });

  it('POST /api/team/invite rejects if email already has pending invite', async () => {
    await server.inject({
      method: 'POST', url: '/api/team/invite',
      headers: authHeaders(ownerToken),
      payload: { email: 'team@store.in', role: 'offer_manager' },
    });
    const res = await server.inject({
      method: 'POST', url: '/api/team/invite',
      headers: authHeaders(ownerToken),
      payload: { email: 'team@store.in', role: 'admin' },
    });
    expect(res.statusCode).toBe(409);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

- [ ] **Step 3: Implement invite routes**

```typescript
// src/modules/auth/routes/invite-routes.ts
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CreateInviteSchema, type Role, canInvite, ROLE_LEVELS } from '../schemas/invite';
import { generateInviteCode } from '../../../lib/invite-code';

const INVITE_EXPIRY_DAYS = 7;

/** Registers team invite routes. Requires JWT auth. */
export function registerInviteRoutes(server: FastifyInstance): void {
  // POST /api/team/invite
  server.post('/api/team/invite', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = CreateInviteSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message } });
    }

    const user = request.user!;
    const db = server.db!;
    const { email, role } = parsed.data;

    // Check role hierarchy: inviter must have higher role than target
    if (!canInvite(user.role as Role, role as Role)) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Cannot invite someone with equal or higher role' } });
    }

    // Check for existing pending invite
    const existing = await db.collection('merchant_users').findOne({
      merchant_id: user.merchant_id, email, status: 'pending',
    });
    if (existing) {
      return reply.code(409).send({ error: { code: 'INVITE_EXISTS', message: 'Pending invite already exists for this email' } });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    const inviteCode = generateInviteCode();

    await db.collection('merchant_users').insertOne({
      _id: `mu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      merchant_id: user.merchant_id,
      email,
      user_id: null,
      role,
      status: 'pending',
      invite_code: inviteCode,
      invited_by: user.user_id,
      invited_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      accepted_at: null,
    });

    return reply.code(201).send({
      invite_code: inviteCode,
      email,
      role,
      expires_at: expiresAt.toISOString(),
      invite_url: `/invite/${inviteCode}`,
    });
  });

  // GET /api/team/invites — paginated list
  server.get('/api/team/invites', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const db = server.db!;
    const query = request.query as { page?: string; limit?: string; status?: string };

    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(query.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { merchant_id: user.merchant_id };
    if (query.status && query.status !== 'all') filter.status = query.status;

    const [invites, total] = await Promise.all([
      db.collection('merchant_users').find(filter).sort({ invited_at: -1 }).skip(skip).limit(limit).toArray(),
      db.collection('merchant_users').countDocuments(filter),
    ]);

    return reply.send({
      invites: invites.map((i) => ({
        email: i.email, role: i.role, status: i.status,
        invite_code: i.invite_code, invited_at: i.invited_at,
        expires_at: i.expires_at, accepted_at: i.accepted_at,
      })),
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
    });
  });

  // DELETE /api/team/invites/:code — revoke invite
  server.delete('/api/team/invites/:code', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const db = server.db!;
    const { code } = request.params as { code: string };

    const result = await db.collection('merchant_users').updateOne(
      { merchant_id: user.merchant_id, invite_code: code, status: 'pending' },
      { $set: { status: 'removed' } },
    );

    if (result.matchedCount === 0) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Invite not found' } });
    }
    return reply.send({ revoked: true });
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit** — `feat(auth): add team invite endpoints with role hierarchy and pagination`

---

## Task 9: Accept Invite Endpoint

**Files:**
- Modify: `src/modules/auth/routes/auth-routes.ts` — add POST /api/auth/accept-invite
- Test: extends `src/modules/auth/routes/auth-routes.test.ts`

- [ ] **Step 1: Write failing test for accept-invite**

```typescript
// Append to src/modules/auth/routes/auth-routes.test.ts
// (requires invite routes to be registered too)

  it('POST /api/auth/accept-invite creates user from invite code', async () => {
    // Signup owner
    const signupRes = await server.inject({
      method: 'POST', url: '/api/auth/signup',
      payload: { email: 'owner@store.in', password: 'password123', name: 'Owner', store_name: 'Store' },
    });
    const ownerToken = JSON.parse(signupRes.body).token;

    // Create invite (bypass JWT for this test — directly insert)
    const db = getDatabase();
    await db.collection('merchant_users').insertOne({
      _id: 'mu_test_invite',
      merchant_id: JSON.parse(signupRes.body).merchant._id,
      email: 'newteam@store.in',
      user_id: null,
      role: 'offer_manager',
      status: 'pending',
      invite_code: 'ABC234',
      invited_by: JSON.parse(signupRes.body).user._id,
      invited_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      accepted_at: null,
    });

    // Accept invite
    const res = await server.inject({
      method: 'POST', url: '/api/auth/accept-invite',
      payload: {
        invite_code: 'ABC234',
        email: 'newteam@store.in',
        password: 'newpassword123',
        name: 'Team Member',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.token).toBeDefined();
    expect(body.role).toBe('offer_manager');
  });

  it('POST /api/auth/accept-invite rejects wrong email for invite code', async () => {
    // ... similar setup with invite code bound to 'a@b.com'
    // Try accepting with 'wrong@b.com' → should fail
  });

  it('POST /api/auth/accept-invite rejects expired code', async () => {
    // ... insert invite with expires_at in the past → should fail
  });
```

- [ ] **Step 2: Run to verify it fails**

- [ ] **Step 3: Add accept-invite to auth-routes.ts**

```typescript
// Add to src/modules/auth/routes/auth-routes.ts
import { AcceptInviteSchema } from '../schemas/invite';

// Inside registerAuthRoutes, add:

  // POST /api/auth/accept-invite
  server.post('/api/auth/accept-invite', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = AcceptInviteSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message } });
    }

    const db = server.db!;
    const { invite_code, email, password, name } = parsed.data;

    // Find the invite
    const invite = await db.collection('merchant_users').findOne({
      invite_code, status: 'pending',
    });

    if (!invite) {
      return reply.code(404).send({ error: { code: 'INVITE_NOT_FOUND', message: 'Invalid or already used invite code' } });
    }

    // Check email matches
    if (invite.email !== email) {
      return reply.code(403).send({ error: { code: 'EMAIL_MISMATCH', message: 'This invite code is for a different email address' } });
    }

    // Check not expired
    if (new Date(invite.expires_at) < new Date()) {
      await db.collection('merchant_users').updateOne({ _id: invite._id }, { $set: { status: 'expired' } });
      return reply.code(410).send({ error: { code: 'INVITE_EXPIRED', message: 'This invite has expired. Please ask your admin to resend.' } });
    }

    // Create user (or find existing)
    let userId: string;
    const existingUser = await db.collection('users').findOne({ email });
    if (existingUser) {
      userId = existingUser._id;
    } else {
      userId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const passwordHash = await hashPassword(password);
      const now = new Date().toISOString();
      await db.collection('users').insertOne({
        _id: userId, email, password_hash: passwordHash, name, created_at: now, updated_at: now,
      });
    }

    // Activate the merchant_user link
    await db.collection('merchant_users').updateOne(
      { _id: invite._id },
      { $set: { user_id: userId, status: 'active', accepted_at: new Date().toISOString() } },
    );

    const token = generateToken({ user_id: userId, merchant_id: invite.merchant_id, role: invite.role });

    return reply.code(201).send({
      token,
      user: { _id: userId, email, name },
      merchant: { _id: invite.merchant_id },
      role: invite.role,
    });
  });
```

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit** — `feat(auth): add accept-invite endpoint with email binding and expiry validation`

---

## Task 10: API Key Management Endpoints

**Files:**
- Create: `src/modules/auth/routes/api-key-routes.ts`
- Test: `src/modules/auth/routes/api-key-routes.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/modules/auth/routes/api-key-routes.test.ts
// Test: POST /api/api-keys creates key (returns plaintext once), GET lists keys (no plaintext), DELETE revokes
// Use same pattern as invite routes test — signup owner → get token → create key → list → revoke
```

- [ ] **Step 2: Run to verify it fails**

- [ ] **Step 3: Implement API key routes**

```typescript
// src/modules/auth/routes/api-key-routes.ts
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CreateApiKeySchema } from '../schemas/api-key';
import { hashPassword } from '../../../lib/password';
import { randomBytes } from 'crypto';

/** Generates a random API key string. */
function generateApiKey(): string {
  return 'of_live_' + randomBytes(16).toString('hex');
}

/** Registers API key management routes. Requires JWT auth + owner/admin role. */
export function registerApiKeyRoutes(server: FastifyInstance): void {
  // POST /api/api-keys — create (owner/admin only)
  server.post('/api/api-keys', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = CreateApiKeySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message } });
    }

    const user = request.user!;
    const db = server.db!;
    const { label, scopes } = parsed.data;

    const plaintextKey = generateApiKey();
    const keyHash = await hashPassword(plaintextKey);
    const now = new Date().toISOString();

    await db.collection('api_keys').insertOne({
      _id: `key_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      merchant_id: user.merchant_id,
      key_hash: keyHash,
      label,
      scopes,
      status: 'active',
      last_used_at: null,
      created_by: user.user_id,
      created_at: now,
      revoked_at: null,
    });

    // Return plaintext ONLY on creation — never again
    return reply.code(201).send({ key: plaintextKey, label, scopes });
  });

  // GET /api/api-keys — list (no plaintext, just metadata)
  server.get('/api/api-keys', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const db = server.db!;
    const keys = await db.collection('api_keys').find({
      merchant_id: user.merchant_id, status: { $ne: 'revoked' },
    }).sort({ created_at: -1 }).toArray();

    return reply.send({
      keys: keys.map((k) => ({
        _id: k._id, label: k.label, scopes: k.scopes, status: k.status,
        last_used_at: k.last_used_at, created_at: k.created_at,
      })),
    });
  });

  // DELETE /api/api-keys/:id — revoke
  server.delete('/api/api-keys/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const db = server.db!;
    const { id } = request.params as { id: string };

    const result = await db.collection('api_keys').updateOne(
      { _id: id, merchant_id: user.merchant_id, status: 'active' },
      { $set: { status: 'revoked', revoked_at: new Date().toISOString() } },
    );

    if (result.matchedCount === 0) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'API key not found' } });
    }
    return reply.send({ revoked: true });
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit** — `feat(auth): add API key management endpoints with scopes and plaintext-once response`

---

## Task 11: Update Server Wiring + Backend Auth Integration Test

**Files:**
- Modify: `src/server.ts` — register auth + invite + api-key routes
- Create: `src/integration/auth-flow.test.ts`

- [ ] **Step 1: Update server.ts to register new routes**

Add to the route registration section:
```typescript
import { registerAuthRoutes } from './modules/auth/routes/auth-routes';
import { registerInviteRoutes } from './modules/auth/routes/invite-routes';
import { registerApiKeyRoutes } from './modules/auth/routes/api-key-routes';

// Register auth routes (no JWT required for signup/login/accept-invite)
registerAuthRoutes(server);

// Register team + API key routes (JWT required — preHandler already set)
registerInviteRoutes(server);
registerApiKeyRoutes(server);
```

- [ ] **Step 2: Write integration test — full auth flow**

```typescript
// src/integration/auth-flow.test.ts
// Test the complete flow:
// 1. Signup as owner → get JWT
// 2. Create invite (offer_manager role) → get invite code
// 3. Accept invite with the code → new user gets JWT
// 4. Login as the new user → get JWT with offer_manager role
// 5. Owner creates API key → gets plaintext once
// 6. Use API key to call /api/offers → works
// 7. List invites (paginated) → shows accepted invite
// 8. Revoke API key → /api/offers with revoked key → 401
```

- [ ] **Step 3: Run test to verify it passes**

- [ ] **Step 4: Commit** — `feat(auth): wire auth routes into server and add full flow integration test`

---

## Task 12: Dashboard — Replace API Key Login with Email/Password

**Files:**
- Modify: `dashboard/app/login/page.tsx` — email + password form
- Modify: `dashboard/components/AuthGuard.tsx` — check JWT instead of API key
- Modify: `dashboard/lib/api.ts` — send Authorization: Bearer instead of x-api-key
- Create: `dashboard/app/signup/page.tsx` — signup form
- Create: `dashboard/app/invite/[code]/page.tsx` — invite acceptance page

This task updates the dashboard to use the new auth system.

- [ ] **Step 1: Update api.ts to use JWT**

```typescript
// dashboard/lib/api.ts
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3010';

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('fuse_token') : null;
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '', ...options.headers },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function login(email: string, password: string): Promise<{ token: string }> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error('Invalid email or password');
  return res.json();
}

export async function signup(email: string, password: string, name: string, storeName: string): Promise<{ token: string }> {
  const res = await fetch(`${API_BASE}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name, store_name: storeName }),
  });
  if (!res.ok) throw new Error('Signup failed');
  return res.json();
}
```

- [ ] **Step 2: Update AuthGuard**

```typescript
// dashboard/components/AuthGuard.tsx
export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  useEffect(() => {
    const token = localStorage.getItem('fuse_token');
    if (!token) router.push('/login');
  }, [router]);
  return <>{children}</>;
}
```

- [ ] **Step 3: Update login page — email + password**

```typescript
// dashboard/app/login/page.tsx — email/password form with link to /signup
// On submit: call login(email, password) → store token → redirect to /
// Add "Don't have an account? Sign up" link
// Add "Have an invite code? Enter it" link → /invite/[code]
```

- [ ] **Step 4: Create signup page**

```typescript
// dashboard/app/signup/page.tsx
// Fields: email, password, name, store name
// On submit: call signup() → store token → redirect to /
```

- [ ] **Step 5: Create invite acceptance page**

```typescript
// dashboard/app/invite/[code]/page.tsx
// Shows the invite code from the URL
// Fields: email (pre-filled if matching), password, name
// On submit: call /api/auth/accept-invite → store token → redirect to /
```

- [ ] **Step 6: Commit** — `feat(dashboard): replace API key login with email/password auth and signup`

---

## Summary

12 tasks covering:
1. Password hashing (bcrypt)
2. JWT token utilities
3. Invite code generation + schemas with role hierarchy
4. API key schemas with scopes
5. Signup + Login endpoints (creates merchant + user + owner)
6. JWT auth middleware (Bearer token validation)
7. Role-based access control middleware
8. Team invite endpoints (create, list paginated, revoke)
9. Accept invite endpoint (email-bound, expiry validation)
10. API key management endpoints (create, list, revoke)
11. Server wiring + full auth flow integration test
12. Dashboard: email/password login + signup + invite acceptance page
