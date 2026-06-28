# SplitSmart

Production-grade app for tracking and settling shared group expenses.

See [`PRD.md`](./PRD.md), [`ARCHITECTURE.md`](./ARCHITECTURE.md), [`ROADMAP.md`](./ROADMAP.md), and [`TASKS.md`](./TASKS.md) for product and engineering context. Contributor and AI-assistant conventions live in [`CLAUDE.md`](./CLAUDE.md).

## Monorepo layout

```
apps/
  api/      NestJS backend (REST + WebSockets)
  web/      Next.js web client
  mobile/   React Native (Expo) mobile client
workers/    BullMQ workers (ocr, notifications, payments, currency-sync)
packages/
  types/        shared TypeScript types / API contracts
  validation/   shared Zod schemas
  ui/           shared UI tokens/components
  config/        shared eslint / tsconfig presets
infra/
  terraform/    infrastructure as code
  docker/       container assets
```

## Prerequisites

- Node.js >= 20
- pnpm >= 9 (`corepack enable && corepack prepare pnpm@latest --activate`)
- Docker (for local Postgres + Redis)

## Getting started

```bash
pnpm install
cp .env.example .env
docker compose up -d        # starts Postgres + Redis
pnpm dev                    # runs all apps via Turborepo
```

API health check: http://localhost:3001/health

## Common scripts

| Command | Description |
|---|---|
| `pnpm dev` | Run all apps in dev mode |
| `pnpm build` | Build all packages and apps |
| `pnpm lint` | Lint the workspace |
| `pnpm typecheck` | Type-check the workspace |
| `pnpm test` | Run all tests |
| `pnpm format` | Format with Prettier |

## Status

Project is at **Milestone 0 — Foundations**. Application features are not implemented yet; this is the scaffold, tooling, and CI baseline. See `TASKS.md`.
