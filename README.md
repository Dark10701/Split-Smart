# SplitSmart

Track and settle shared group expenses — India-first, with **UPI settle-up**. Log an
expense, split it any way (equal, exact, %, shares, or itemized), see who owes whom with
the fewest transfers, and settle up in two taps through any UPI app.

See [`PRD.md`](./PRD.md), [`ARCHITECTURE.md`](./ARCHITECTURE.md), [`ROADMAP.md`](./ROADMAP.md), and [`TASKS.md`](./TASKS.md) for product and engineering context. Contributor and AI-assistant conventions live in [`CLAUDE.md`](./CLAUDE.md).

## Monorepo layout

```
apps/
  api/      NestJS backend (REST + WebSockets, Prisma/Postgres, Redis)
  web/      Next.js web client (Google Pay-style app UI)
  mobile/   React Native (Expo) mobile client
workers/    BullMQ workers (ocr, notifications, payments, currency-sync)
packages/
  types/        shared TypeScript types / API contracts (+ money & UPI helpers)
  validation/   shared Zod schemas
  ui/           shared UI tokens/components
  config/        shared eslint / tsconfig presets
infra/
  terraform/    infrastructure as code
  docker/       container assets
```

## Prerequisites

- **Node.js ≥ 20**
- **pnpm ≥ 9** — `corepack enable && corepack prepare pnpm@latest --activate`
- **Docker Desktop** (for local Postgres + Redis)

## Run it locally

### One command (this is the way)

Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and Node.js 20+ once. After that, running SplitSmart is a single command from the repo root:

```bash
pnpm install   # first time only
pnpm start     # everything: Docker, migrations, auth, API, web — one terminal
```

(`pnpm dev:local` is the same thing.) On Windows you can instead **double-click
`start-splitsmart.cmd`** in the repo root. Re-running while the app is already
up just prints the URL instead of failing halfway.

The launcher creates missing development environment files, starts Postgres and Redis in Docker,
waits for the database, applies Prisma migrations, and starts the local auth issuer, API, and web
app in one terminal. Open **http://localhost:3000** and **create an account**
(name, email, mobile number, password — the email verification code is shown
on-screen in dev; real deployments email it). Sign in later with your email
*or* mobile number + password.
Press `Ctrl+C` to stop the app processes; Docker services remain running for the next launch.

### Manual setup (optional — you almost never need this)

Only useful if you want each service in its own terminal (e.g. to restart one
independently). Otherwise use `pnpm start` above and skip this section.

From the repo root:

```bash
# 1. Install dependencies
pnpm install

# 2. Create your env file (the defaults already match the Docker services below).
#    The copy into apps/api is for the Prisma CLI, which only reads .env from
#    the package it runs in (the API server itself reads the root one).
cp .env.example .env
cp .env.example apps/api/.env

# 3. Start Postgres + Redis
docker compose up -d

# 4. Generate the Prisma client and apply the database migrations
pnpm --filter @splitsmart/api prisma:generate
pnpm --filter @splitsmart/api prisma:deploy
```

> **If step 4 says `Environment variable not found: DATABASE_URL`**, you skipped
> the `cp .env.example apps/api/.env` line above — the Prisma CLI only reads the
> `.env` next to its own package, not the repo root.

Now start the app. You need **three things running** — the auth issuer, the API, and the web client:

```bash
# Terminal A — local dev auth issuer (stands in for Auth0/Clerk). Leave it running.
pnpm --filter @splitsmart/api dev:auth

# Terminal B — the API (http://localhost:3001)
pnpm --filter @splitsmart/api dev

# Terminal C — the web app (http://localhost:3000)
pnpm --filter @splitsmart/web dev
```

Then:

1. Open **http://localhost:3000** → **Create account** (name, email, mobile,
   password); enter the 6-digit code shown on-screen to verify → you're in.
2. Sign in later with your email **or** mobile number + password.
3. Create a group, add expenses, split them, and settle up. Register a second
   account (in a private window) to see shared membership and balances.

**Health check:** http://localhost:3001/health → `{"status":"ok"}`

> **Why the dev auth issuer?** The API validates real OIDC JWTs (issuer, audience,
> JWKS signature). Rather than provision an Auth0/Clerk tenant just to click around,
> `dev:auth` runs a tiny local identity provider on port 3999 and mints valid tokens.
> It is **local-development only** — never deploy it. For production, point
> `AUTH_ISSUER_URL` / `AUTH_AUDIENCE` / `AUTH_JWKS_URI` at your real provider.

### Everything at once (optional)

`pnpm dev` runs every app/worker together via Turborepo. You still need the dev auth
issuer (`pnpm --filter @splitsmart/api dev:auth`) in a separate terminal to sign in.

### Mobile (Expo)

```bash
pnpm --filter @splitsmart/mobile dev     # then press i / a, or scan the QR in Expo Go
```

Set `EXPO_PUBLIC_API_URL` to your machine's LAN IP (not `localhost`) if running on a
physical device.

## Common scripts

| Command | Description |
|---|---|
| `pnpm start` | **The one command**: Docker, database, auth, API, and web in one terminal |
| `pnpm dev` | Run all apps/workers in dev mode (Turborepo) |
| `pnpm dev:local` | Same as `pnpm start` |
| `pnpm build` | Build all packages and apps |
| `pnpm lint` | Lint the workspace |
| `pnpm typecheck` | Type-check the workspace |
| `pnpm test` | Run all tests |
| `pnpm format` | Format with Prettier |
| `pnpm --filter @splitsmart/api dev:auth` | Local dev token issuer |
| `pnpm --filter @splitsmart/api prisma:deploy` | Apply DB migrations |

> **API restarting constantly / feeling flaky?** If the repo lives inside a
> OneDrive/Dropbox-synced folder, the sync client touches files continuously and
> retriggers the dev watchers (the API recompiles and restarts in a loop). The
> watcher now ignores `dist/`, which removes the worst of it — but for a smooth
> experience keep dev repos in a non-synced path (e.g. `C:\dev\split-smart`) or
> pause syncing while developing.

## Observability (optional)

The API is instrumented but stays a no-op unless configured:

- `OTEL_TRACES_CONSOLE=1` prints OpenTelemetry spans to stdout; set
  `OTEL_EXPORTER_OTLP_ENDPOINT` to export to a collector instead.
- `SENTRY_DSN` enables server-side error tracking.
- `GET /metrics` exposes Prometheus metrics (process + per-route HTTP counters).

## Tech stack

TypeScript everywhere. **NestJS** API (Prisma + PostgreSQL, Redis, BullMQ workers,
socket.io realtime), **Next.js** web, **React Native (Expo)** mobile, OAuth/OIDC auth.
Money is stored as **integer paise** with an explicit currency (never floats); the
balance engine is pure and exhaustively unit-tested.

## Status

Milestones **M0–M6 are essentially complete** (auth & groups, expenses & splitting,
settlement, payment orchestration, UPI settle-up, and production hardening — rate
limiting, audit logging, GDPR export/delete, metrics, tracing, graceful degradation,
accessibility). Remaining work is external infrastructure (managed backups, load-test
rig, alerting), the mobile offline-sync feature, and **M7 — Public Launch**. See
[`TASKS.md`](./TASKS.md) for the detailed ticket status.
