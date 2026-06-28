# Multi-stage build for the SplitSmart API.
FROM node:20-slim AS base
RUN corepack enable
WORKDIR /app

# --- Dependencies / build ---
FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @splitsmart/api prisma:generate
RUN pnpm --filter @splitsmart/api build

# --- Runtime ---
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "dist/main.js"]
