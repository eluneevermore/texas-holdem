# ──────────────────────────────────────
# Base – Node 22 + pnpm
# ──────────────────────────────────────
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# ──────────────────────────────────────
# Dependencies – install from lockfile
# ──────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
RUN pnpm install --frozen-lockfile

# ──────────────────────────────────────
# Build – compile shared, server, web
# ──────────────────────────────────────
FROM deps AS build
COPY turbo.json ./
COPY packages/shared/ packages/shared/
COPY tsconfig.base.json ./
COPY packages/server/ packages/server/
RUN pnpm --filter @poker/server exec prisma generate
RUN pnpm build --filter @poker/server

# ──────────────────────────────────────
# Server – Node runtime for Fastify API
# ──────────────────────────────────────
FROM base AS server
COPY --from=build /app ./
ENV NODE_ENV=production
EXPOSE 3001
CMD ["sh", "-c", "cd packages/server && pnpm exec prisma migrate deploy && node dist/index.js"]
