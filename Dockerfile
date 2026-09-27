# Fuse API — Fastify + MongoDB
# Multi-stage build: compile TypeScript in builder, run slim Node image in runner.

# ---- builder ----
FROM node:20-slim AS builder

WORKDIR /app

# Install all deps (including devDeps for tsc)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build TypeScript -> dist/
COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

# ---- deps-prune ----
# Reinstall only production deps in a clean layer for the runner
FROM node:20-slim AS deps-prune

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- runner ----
FROM node:20-slim AS runner

# Run as non-root user (node:20-slim includes a "node" user)
WORKDIR /app

# Copy production deps from prune stage
COPY --from=deps-prune /app/node_modules ./node_modules

# Copy compiled output + package.json (for "type" + scripts)
COPY --from=builder /app/dist ./dist
COPY package.json ./

# Healthcheck hits the Fastify /health endpoint
# Render also monitors this via its own health check path
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

USER node

EXPOSE 3000

# Render sets PORT env; server listens on 0.0.0.0:${PORT}
CMD ["node", "dist/server.js"]
