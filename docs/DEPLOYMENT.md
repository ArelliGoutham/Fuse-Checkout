# Deployment Guide — Vercel Frontends

This repo has **3 frontend surfaces** targetable to Vercel, plus a Fastify API + MongoDB that need separate hosting.

## Surfaces

| Surface | Dir | Type | Vercel framework |
|---|---|---|---|
| Marketing website | `website/` | Static HTML/CSS/JS | `null` (static) |
| Merchant dashboard | `dashboard/` | Next.js 16 (App Router) | `nextjs` |
| Hosted checkout | `checkout/` | Next.js 16 (App Router) | `nextjs` |

Each has its own `vercel.json` and `.env.example` (where applicable).

## Prerequisites

1. A [Vercel](https://vercel.com) account.
2. The Fastify API deployed somewhere reachable (e.g. Railway/Render/Fly) as `https://api.<your-domain>`. The frontends call this via `NEXT_PUBLIC_API_BASE`.
3. MongoDB Atlas for the API's `MONGO_URI`.

## Deploy each surface on Vercel

The repo is a monorepo with three independent Vercel projects. Import the repo once, then create one project per surface with the correct root directory.

### 1. Dashboard (`dashboard/`)

1. Vercel dashboard → **Add New… → Project** → import this GitHub repo.
2. Set **Root Directory** to `dashboard`.
3. Framework preset: **Next.js** (auto-detected from `vercel.json`).
4. Environment variables (Project → Settings → Environment Variables):
   - `NEXT_PUBLIC_API_BASE` = `https://api.<your-domain>` (the deployed Fastify API)
5. **Deploy**.

Local preview of production values:
```bash
cp dashboard/.env.example dashboard/.env.local
# edit .env.local → set NEXT_PUBLIC_API_BASE to your deployed API
```

### 2. Checkout (`checkout/`)

1. Same flow as dashboard, **Root Directory** = `checkout`.
2. Environment variables:
   - `NEXT_PUBLIC_API_BASE` = `https://api.<your-domain>`
   - `NEXT_PUBLIC_API_KEY` = optional, for authenticated server-side calls
3. **Deploy**.

### 3. Website (`website/`)

1. Same flow, **Root Directory** = `website`.
2. Framework: **Other** (static). `vercel.json` sets `outputDirectory: "."` and no build command.
3. No env vars needed — the website derives the API base from `location.hostname` in `website/checkout/app.js` (production → `https://api.offerforge.io`). Update that fallback if your API domain differs.
4. **Deploy**.

## Custom domains

Once a project is deployed, Vercel → Project → Settings → Domains to attach:
- `app.<your-domain>` → dashboard
- `checkout.<your-domain>` → checkout
- `<your-domain>` / `www.<your-domain>` → website

Update `BRAND_DOMAIN` and the API CORS allowlist (`src/config` / `@fastify/cors` in `src/server.ts`) to include the new frontend origins.

## Notes

- Next.js 16 on Vercel uses the **Vercel verified adapter** (fully supported per `node_modules/next/dist/docs/01-app/01-getting-started/17-deploying.md`).
- `NEXT_PUBLIC_*` vars are inlined at build time — set them in Vercel **before** deploying, or redeploy after changing them.
- The API is **not** part of this Vercel setup. See the ROADMAP "Remaining Infrastructure" section for hosting it (needs a `Dockerfile`, planned separately).
