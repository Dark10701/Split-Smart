# SplitSmart — System Architecture

**Version:** 1.0
**Status:** Draft
**Last updated:** June 28, 2026
**Companion doc:** PRD.md

---

## 1. Architecture Overview

SplitSmart is a cloud-native, API-first application built around a small set of services rather than a sprawling microservice mesh — a **modular monolith backend** plus a few isolated workers (OCR, notifications, payments). This keeps the system simple to operate at launch while leaving clean seams to extract services as scale demands.

```
                    ┌─────────────────────────────┐
                    │        Clients              │
                    │  iOS / Android (RN)  ·  Web  │
                    └──────────────┬──────────────┘
                                   │ HTTPS / WSS
                          ┌────────▼────────┐
                          │  API Gateway /  │   Auth, rate limiting,
                          │  Load Balancer  │   TLS termination
                          └────────┬────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │     Backend (modular)         │
                    │  Groups · Expenses · Balances │
                    │  Settlement · Users · Feed    │
                    └───┬─────────┬─────────┬───────┘
                        │         │         │
              ┌─────────▼──┐ ┌────▼─────┐ ┌─▼─────────────┐
              │ PostgreSQL │ │  Redis   │ │  Message Queue│
              │ (primary)  │ │ (cache)  │ │  (jobs/events)│
              └────────────┘ └──────────┘ └───┬───────────┘
                                               │
                 ┌─────────────────────────────┼───────────────┐
            ┌────▼─────┐   ┌──────────────┐ ┌──▼───────────┐ ┌──▼────────┐
            │ OCR      │   │ Notification │ │ Payment      │ │ Currency  │
            │ worker   │   │ worker       │ │ worker       │ │ sync job  │
            └────┬─────┘   └──────┬───────┘ └──────┬───────┘ └───────────┘
                 │                │                │
          Object Storage   Push/Email/SMS    Payment Processor
          (receipts)       providers         (Stripe)
```

---

## 2. Recommended Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Mobile | **React Native (Expo)** + TypeScript | One codebase for iOS + Android, large ecosystem, OTA updates, fast iteration. TypeScript shares types with the backend. |
| Web | **Next.js (React)** + TypeScript | SSR/SSG for marketing + dashboard, shares components and types with RN, strong SEO and performance. |
| Backend | **Node.js + NestJS** (TypeScript) | Structured, modular framework with DI and clear boundaries; same language as clients reduces context-switching and enables shared types. |
| API | **REST (OpenAPI)** + **WebSockets** | REST for CRUD with a documented contract; WebSockets for real-time balance/feed updates. (GraphQL considered — see §13.) |
| Database | **PostgreSQL** | ACID guarantees are non-negotiable for money. Strong relational modeling, transactions, decimal precision, mature tooling. |
| Cache / realtime | **Redis** | Low-latency cache, pub/sub for realtime fan-out, rate-limit counters, session/token store. |
| Queue / events | **BullMQ (Redis)** at launch → **SQS/Kafka** at scale | Reliable async jobs for OCR, notifications, payments; decouples slow work from request path. |
| Object storage | **AWS S3** (or compatible) | Durable, cheap receipt/image storage with lifecycle policies and signed URLs. |
| Auth | **OAuth 2.0 / OIDC via Auth0 (or Clerk)** | Offloads social login, MFA, and token security to a hardened provider; PKCE for mobile. |
| OCR | **Cloud OCR (AWS Textract / Google Vision)** + worker | Production-grade receipt extraction without training models in-house. |
| Notifications | **FCM/APNs** (push), **SendGrid** (email), **Twilio** (SMS) | Best-in-class, reliable delivery per channel. |
| Payments | **Stripe** (Connect / payment intents) | PCI-compliant, idempotent APIs, broad coverage; SplitSmart never holds funds. |
| Infra | **AWS** + **Docker** + **Kubernetes (EKS)** or **ECS Fargate** | Standard, scalable, portable container orchestration. Fargate for lower ops overhead early. |
| IaC | **Terraform** | Reproducible, version-controlled infrastructure. |
| CI/CD | **GitHub Actions** | Tight repo integration, mature ecosystem, easy environment gating. |
| Observability | **OpenTelemetry** + **Grafana/Prometheus** + **Sentry** | Tracing, metrics, dashboards, and error tracking across services. |

---

## 3. Frontend

**Mobile (React Native + Expo).** Primary surface. Offline-first: expense entry writes to a local store (SQLite/WatermelonDB or MMKV) and syncs through a reconciliation queue. State managed with **React Query** (server state) plus a lightweight store (**Zustand**) for UI state. Navigation via **React Navigation**. Real-time updates over a WebSocket connection that invalidates React Query caches.

**Web (Next.js).** Marketing site, account management, and a full dashboard with feature parity goals. Shares a `packages/ui` component library and `packages/types` with mobile in a monorepo. SSR for first-load performance and SEO.

**Cross-cutting:** TypeScript everywhere, shared validation schemas (**Zod**) reused on client and server, design tokens for theming (light/dark), and i18n via **i18next**.

---

## 4. Backend

A **NestJS modular monolith**: each domain is a module with its own controllers, services, and repository layer, communicating through well-defined interfaces and domain events. This gives clean boundaries (easy to later extract into services) without premature distribution.

Core modules:

- **Users & Auth** — profiles, sessions, preferences, OIDC integration.
- **Groups** — membership, roles, invitations, guests.
- **Expenses** — creation, edits (versioned), split strategies, receipts.
- **Balances** — deterministic balance engine + debt-minimization algorithm.
- **Settlement** — manual settlements and payment-intent orchestration.
- **Feed & Comments** — auditable activity log.
- **Notifications** — preference resolution + dispatch to workers.

The **balance engine** is a pure, deterministic module: given the ordered set of expenses and payments for a group it computes per-pair balances, then runs debt simplification to produce the minimum transaction set. Being side-effect-free makes it exhaustively testable.

Slow or external work (OCR, notification delivery, payment capture, currency refresh) is pushed onto the queue and handled by **workers**, keeping API latency low and isolating third-party failures.

---

## 5. Database

**PostgreSQL** is the system of record. Money is stored as integer minor units (e.g. cents) with an explicit currency code — never floating point. Schema highlights:

```
users(id, email, name, default_currency, created_at, ...)
groups(id, name, created_by, default_currency, created_at)
group_members(group_id, user_id, role, joined_at, removed_at)
expenses(id, group_id, payer_id, amount_minor, currency, category,
         description, occurred_at, created_by, version, deleted_at)
expense_splits(expense_id, user_id, share_minor, split_type)
payments(id, group_id, from_user, to_user, amount_minor, currency,
         method, provider_ref, status, idempotency_key, created_at)
receipts(id, expense_id, storage_key, ocr_status, ocr_json)
activity_log(id, group_id, actor_id, entity_type, entity_id, action, payload, created_at)
comments(id, expense_id, user_id, body, created_at)
notification_prefs(user_id, channel, type, enabled)
```

Design principles: every financial mutation is **versioned and append-aware** (soft-delete + activity log, never silent loss); payments carry an **idempotency key** to prevent double processing; foreign keys and check constraints enforce that splits reconcile to totals. Read-heavy balance queries are cached in Redis and invalidated on mutation. Migrations managed with **Prisma Migrate** (or TypeORM). Partitioning of `expenses`/`activity_log` by group or time is introduced as data grows; read replicas absorb reporting load.

---

## 6. Authentication & Authorization

**AuthN** via OAuth 2.0 / OIDC through a managed provider (Auth0 or Clerk): email/password, Google, and Apple sign-in, with **PKCE** for mobile and optional **MFA**. The provider issues short-lived JWT access tokens plus rotating refresh tokens; the backend validates JWTs at the gateway and resolves the internal user.

**AuthZ** is enforced server-side with role- and resource-based checks: a user may only access groups they belong to, and only admins can manage membership or delete the group. Every protected endpoint verifies group membership before returning data. Sensitive actions (settlement, member removal) are additionally logged to the activity trail. Rate limiting and brute-force protection sit at the gateway.

---

## 7. Storage (Receipts & Files)

Receipt images and exports live in **S3** (or S3-compatible) object storage, never in the database. Clients upload directly to S3 via short-lived **pre-signed URLs** (offloads bandwidth from the API), and the object key is recorded on the `receipts` row. Buckets are private; images are served back through signed read URLs. Lifecycle policies transition old receipts to cheaper storage tiers and enforce retention. Uploaded objects are virus/type-scanned before being marked available, and an upload triggers the OCR pipeline.

---

## 8. OCR Pipeline

The OCR flow is fully asynchronous so a slow vendor never blocks expense entry:

1. Client uploads receipt to S3 via pre-signed URL; backend creates a `receipt` row with `ocr_status = pending` and enqueues an OCR job.
2. The **OCR worker** pulls the job, calls the OCR provider (**AWS Textract** / **Google Vision**) on the stored image.
3. Extracted fields (merchant, date, total, line items, tax) are normalized and written to `receipts.ocr_json`; `ocr_status` becomes `done` (or `failed`, with retry/backoff).
4. The backend emits a realtime event so the client can pre-fill the expense form — total, suggested category, and itemized splits — which the user confirms or edits.

This isolates third-party latency and cost, supports retries, and keeps a clear seam to swap providers or add an in-house model later (see PRD future features).

---

## 9. Notifications

A **preference-aware, multi-channel** system. When a domain event occurs (new expense, settle-up request, payment confirmation, reminder), the backend resolves each recipient's `notification_prefs` and enqueues per-channel jobs. The **notification worker** dispatches to:

- **Push** — FCM (Android) / APNs (iOS) via a unified abstraction.
- **Email** — SendGrid (templated, transactional).
- **SMS** — Twilio (reserved for high-value events like settle-up reminders).
- **In-app** — written to the feed and pushed over WebSocket.

Delivery is retried with backoff; failures are logged and surfaced in observability. Reminders are scheduled jobs (adaptive timing is a future enhancement).

---

## 10. Deployment

**Containerized** services (API, each worker) built into Docker images by **GitHub Actions** and deployed to **AWS ECS Fargate** (low ops) or **EKS** (when finer control is needed). Infrastructure is defined in **Terraform**.

Pipeline: PR → lint + typecheck + unit/integration tests → build image → deploy to **staging** → automated smoke tests → manual gate → **production** (blue/green or rolling). Mobile ships through **EAS Build** to the App Store / Play Store, with **Expo OTA** for JS-only fixes. Secrets in AWS Secrets Manager; config via environment per stage (dev/staging/prod). Autoscaling on CPU/latency; managed Postgres (RDS, multi-AZ) and Redis (ElastiCache) with automated backups and PITR. CDN (CloudFront) fronts the web app and static assets.

---

## 11. Folder Structure

A **TypeScript monorepo** (pnpm workspaces + Turborepo) so types, validation, and UI are shared:

```
splitsmart/
├── apps/
│   ├── mobile/                 # React Native (Expo)
│   │   ├── src/
│   │   │   ├── screens/
│   │   │   ├── components/
│   │   │   ├── features/       # expenses, groups, settle, feed
│   │   │   ├── store/          # zustand, react-query
│   │   │   ├── offline/        # local db + sync queue
│   │   │   └── navigation/
│   │   └── app.config.ts
│   ├── web/                    # Next.js
│   │   ├── app/                # routes
│   │   ├── components/
│   │   └── lib/
│   └── api/                    # NestJS backend
│       ├── src/
│       │   ├── modules/
│       │   │   ├── auth/
│       │   │   ├── users/
│       │   │   ├── groups/
│       │   │   ├── expenses/
│       │   │   ├── balances/   # balance engine + debt minimization
│       │   │   ├── settlement/
│       │   │   ├── feed/
│       │   │   └── notifications/
│       │   ├── common/         # guards, interceptors, filters
│       │   ├── events/         # domain events
│       │   └── main.ts
│       └── test/
├── workers/
│   ├── ocr/
│   ├── notifications/
│   ├── payments/
│   └── currency-sync/
├── packages/
│   ├── types/                  # shared TS types / API contracts
│   ├── validation/             # shared Zod schemas
│   ├── ui/                     # shared components / design tokens
│   └── config/                 # eslint, tsconfig, prettier
├── infra/
│   ├── terraform/
│   └── docker/
├── .github/workflows/          # CI/CD
└── package.json
```

---

## 12. Cross-Cutting Concerns

**Security:** TLS everywhere, JWT validation at the gateway, least-privilege IAM, encrypted storage, OWASP mitigations, dependency scanning, and secrets management. Payment card data never touches SplitSmart servers.

**Observability:** OpenTelemetry tracing across API and workers, Prometheus/Grafana metrics with SLO alerts, centralized structured logs, and Sentry for client + server error tracking.

**Reliability:** Idempotent payment operations, queue-based isolation of third-party failures, database backups with point-in-time recovery, and graceful degradation when external providers are down.

**Testing:** Unit tests for the (pure) balance engine, integration tests per module against an ephemeral Postgres, contract tests on the OpenAPI spec, and end-to-end tests on critical flows (add expense → balance → settle).

---

## 13. Key Decisions & Trade-offs

- **Modular monolith over microservices (v1):** lower operational cost and complexity at launch; clean module boundaries preserve the option to extract services later.
- **REST + WebSockets over GraphQL:** simpler caching, a documented contract, and straightforward realtime; GraphQL remains an option if client data-fetching needs grow.
- **Managed auth/payments/OCR over in-house:** moves PCI, identity, and ML burden to specialized providers so the team focuses on core splitting logic.
- **Postgres over NoSQL:** financial correctness and relational integrity outweigh schema flexibility; the data is inherently relational.
- **React Native + Next.js in one monorepo:** maximizes code/type sharing and team velocity across platforms.

---

*End of document.*
