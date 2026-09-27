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

- Next.js 16 on Vercel uses the **Vercel verified adapter** (fully supported per `node_modules/next/dist/docs/01-getting-started/17-deploying.md`).
- `NEXT_PUBLIC_*` vars are inlined at build time — set them in Vercel **before** deploying, or redeploy after changing them.
- The API is **not** part of this Vercel setup. See the "Backend (Fastify API + MongoDB)" section below.

---

## Backend (Fastify API + MongoDB)

The API is a long-lived Fastify process + in-process cron jobs (session expiry, anomaly detection, alert cleanup). It cannot run on Vercel Functions (crons need a persistent process). It deploys as a Docker container.

### Architecture

```
MongoDB Atlas M0 (free, 512MB, Mumbai aws-ap-south-1)
        ↑
Fastify API (Render free Web Service, Docker)
        ↑
Vercel frontends (dashboard, checkout, website — already deployed)
```

### Artifacts in this repo

| File | Purpose |
|---|---|
| `Dockerfile` | Multi-stage build: `tsc` → `node dist/server.js`, non-root, ~150MB |
| `.dockerignore` | Excludes `dashboard/`, `checkout/`, `website/`, `node_modules`, `dist`, docs, images |
| `render.yaml` | Render Blueprint — `New → Blueprint → select repo` creates the service |

### Deploy on Render (free tier — $0/mo, sleeps after 15 min idle)

1. **MongoDB Atlas** (do this first — the API needs the connection string at boot):
   1. Sign up at https://cloud.mongodb.com.
   2. Create a free **M0** cluster in **Mumbai** (`aws-ap-south-1`).
   3. Database Access → add a user (username + password).
   4. Network Access → allow `0.0.0.0/0` (Render's outbound IPs are dynamic; lock down later via VPC peering on paid plans).
   5. Connect → "Drivers" → copy the `mongodb+srv://...` connection string.

2. **Render Web Service**:
   - Option A — Blueprint (recommended): Dashboard → **New → Blueprint** → select `ArelliGoutham/Fuse-Checkout` → Render reads `render.yaml` and provisions `fuse-api`.
   - Option B — Manual: **New → Web Service** → select the repo → Runtime: **Docker** → Root Directory: `.` (repo root) → Render auto-detects `Dockerfile` → Plan: **Free**.

3. **Set secret env vars** in Render (Project → Environment):
   - `MONGO_URI` = your Atlas `mongodb+srv://...` string (replace `<password>`)
   - `ENCRYPTION_KEY` = a new 32-byte key — generate with `openssl rand -hex 32` (do **not** reuse the `.env.example` placeholder)
   - Non-secret defaults (`NODE_ENV`, `BRAND_NAME`, `PORT`, `ALERT_*`) are carried by `render.yaml`.

4. **Deploy**. Render builds the Docker image and starts the container. Check logs for `✓ Connected to MongoDB` + `✓ Server listening on port 3000`.

5. **Verify**: `curl https://<your-service>.onrender.com/health` → `{ status: "ok", brand: "Fuse", ... }`.

6. **Point the frontends at the API**: update `NEXT_PUBLIC_API_BASE` on the dashboard + checkout Vercel projects to the Render URL, then redeploy:
   ```bash
   # In each dir (dashboard/, checkout/):
   vercel env rm NEXT_PUBLIC_API_BASE production --yes
   vercel env add NEXT_PUBLIC_API_BASE production   # paste https://<your-service>.onrender.com
   vercel --prod --yes
   ```

### Free-tier limitations to know

- **Render free sleeps** after 15 min of no inbound requests. First request after sleep takes ~30s cold start. Fine for demos; upgrade to Render Starter ($7/mo) for always-on.
- **Atlas M0** is 512MB shared RAM/CPU. Plenty for dev/demo. Upgrade to M10 ($9/mo) before real traffic.
- Render free is only available in `oregon` (not Mumbai) — latency from India to Oregon is ~200ms. Acceptable for a portfolio/demo API. For production, upgrade Render to a paid plan in `singapore` and Atlas stays in Mumbai.
