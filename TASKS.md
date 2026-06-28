# SplitSmart — Task Breakdown

**Version:** 1.0
**Last updated:** June 28, 2026
**Companion docs:** PRD.md, ARCHITECTURE.md, ROADMAP.md

Every ticket below is scoped to be completable in **under two hours**. Tickets are grouped by milestone (see ROADMAP.md) and prefixed with an ID. Check boxes track completion.

---

## M0 — Foundations

> **Status (2026-06-28):** Scaffold authored **and verified by building/running**.
> `pnpm install` succeeds; shared packages, all four workers, web, and mobile
> type-check/build cleanly; package tests pass (6/6); the API builds and the
> NestJS server boots with `GET /health` returning `{"status":"ok"}` (HTTP 200).
> Items still `[ ]` need a live database or cloud resources. NOTE: `prisma
> generate` must be run on your machine — Prisma's engine CDN was blocked in the
> verification sandbox, so the API was boot-tested without the DB module there.

- [x] **M0-01** Initialize git repo, license, README, and `.gitignore`. *(repo + README + .gitignore done; add a LICENSE if open-sourcing)*
- [x] **M0-02** Set up pnpm workspace + Turborepo config.
- [x] **M0-03** Add shared `packages/config` (eslint, prettier, tsconfig base).
- [x] **M0-04** Scaffold `packages/types` with a placeholder shared type + build.
- [x] **M0-05** Scaffold `packages/validation` with Zod and one sample schema.
- [x] **M0-06** Scaffold `packages/ui` with a theme/token file.
- [x] **M0-07** Scaffold NestJS app in `apps/api` with `/health` endpoint.
- [x] **M0-08** Add Dockerfile for the API service.
- [x] **M0-09** Write `docker-compose.yml` for Postgres + Redis locally.
- [x] **M0-10** Add database client (Prisma/TypeORM) + initial connection config. *(Prisma client + PrismaService)*
- [~] **M0-11** Create initial migration (empty/baseline) and run it. *(baseline `schema.prisma` written; `prisma migrate dev` not yet run — needs a live DB)*
- [x] **M0-12** Add Redis connection module to the API.
- [x] **M0-13** Scaffold Expo mobile app in `apps/mobile`. *(type-checks cleanly; `expo start` device run still do locally)*
- [x] **M0-14** Scaffold Next.js web app in `apps/web`. *(type-checks cleanly)*
- [x] **M0-15** Wire mobile + web to call the `/health` endpoint.
- [x] **M0-16** Add unit test harness (Jest for API, Vitest for packages) with passing tests authored.
- [x] **M0-17** Create GitHub Actions workflow: install + lint + typecheck.
- [x] **M0-18** Extend CI to run tests and build all apps.
- [x] **M0-19** Add Terraform skeleton in `infra/terraform` (no resources yet).
- [ ] **M0-20** Provision staging Postgres + Redis (managed) via Terraform. *(requires AWS credentials)*
- [ ] **M0-21** Add CD step to deploy API image to staging (Fargate/ECS). *(requires cloud account + registry)*
- [x] **M0-22** Document local setup in CONTRIBUTING/README.

### M0 verification

- [x] **M0-V1** `pnpm install` succeeds; `pnpm-lock.yaml` regenerated/updated.
- [x] **M0-V2** Build + tests verified: packages (build + 6 passing tests), workers (build), web + mobile (typecheck), API (build + passing health test, server boots `/health` → 200). *Fixes applied during verification: added `@types/node` to types/validation/mobile; resolved a BullMQ/ioredis version clash in workers; added `class-validator`/`class-transformer` to the API; added `apps/api/tsconfig.build.json`; removed an unsupported Expo `newArchEnabled` field.*
- [ ] **M0-V3** `docker compose up -d` and confirm Postgres + Redis healthy. *(needs Docker — run locally)*
- [ ] **M0-V4** On your machine: `pnpm --filter @splitsmart/api prisma:generate`, then `pnpm dev` — confirm API `/health` → ok with the DB module, web shows API health, Expo app boots. *(Prisma engine CDN was blocked in the sandbox, so DB-connected boot is the one step to confirm locally.)*

---

## M1 — Auth & Groups

> **Auth slice (2026-06-28):** M1-02..07 implemented and verified. Tested:
> API source type-checks clean; full API jest suite passes (users service,
> health, auth claims); validation schemas build + pass; and the
> `0000_init_auth` migration was executed against a Postgres engine — FK,
> unique `(userId,channel,type)`, and enum constraints all enforce correctly.
> Still to do on a Prisma-enabled machine: `prisma generate` + `prisma migrate
> dev` against a live Postgres, and configure an OIDC provider for M1-01.
>
> **Groups slice (2026-06-28):** M1-12..18, M1-20/21/25 implemented and verified —
> API type-checks clean, full jest suite passes (13 tests / 5 suites), and the
> `0001_groups` migration was run on a Postgres engine (FK to User, unique
> member, guest NULLs, unique invite token, role enum all enforce). Remaining
> in M1: M1-01 (create an OIDC provider tenant) and, for production auth, wiring
> Google/Apple SDKs + refresh rotation (M1-09 needs an Apple dev build).
>
> **Client UI (2026-06-28):** mobile (login, groups list, create, detail, invite
> share) and web (login, groups) implemented; both type-check clean. API invite-
> by-email verified (15 tests). Auth uses a dev bearer-token sign-in; swap in the
> OIDC provider flow once M1-01 is configured.

- [ ] **M1-01** Add auth provider (Auth0/Clerk) tenant + app config. *(external: create the tenant; code reads `AUTH_ISSUER_URL`/`AUTH_AUDIENCE`/`AUTH_JWKS_URI`)*
- [x] **M1-02** Implement JWT validation guard in the API gateway layer. *(`JwtAuthGuard` — JWKS verify, issuer/audience, claims attached)*
- [x] **M1-03** Create `users` table + migration. *(`User` model + `0000_init_auth` migration)*
- [x] **M1-04** Implement "resolve/create internal user from token" service. *(`UsersService.resolveFromClaims`)*
- [x] **M1-05** Build `GET /me` profile endpoint.
- [x] **M1-06** Build `PATCH /me` to update name + default currency. *(validated with shared `updateMeSchema`)*
- [x] **M1-07** Add `notification_prefs` table + default seeding on signup. *(`NotificationPref` model + `defaultNotificationPrefs`)*
- [x] **M1-08** Mobile: login screen + auth context. *(dev token sign-in; wire Google/email via expo-auth-session for production)*
- [~] **M1-09** Mobile: Apple sign-in. *(login flow + token handoff in place; needs `expo-apple-authentication` + an Apple dev build)*
- [x] **M1-10** Mobile: token storage (`expo-secure-store`). *(refresh-token rotation pending real provider)*
- [x] **M1-11** Web: login + session handling. *(cookie-backed auth context, /login + /groups)*
- [x] **M1-12** Create `groups` + `group_members` tables + migration. *(Group/GroupMember/Invitation + `0001_groups`)*
- [x] **M1-13** `POST /groups` create group endpoint. *(creator added as admin in a transaction)*
- [x] **M1-14** `GET /groups` list my groups endpoint.
- [x] **M1-15** `GET /groups/:id` group detail with membership.
- [x] **M1-16** Implement membership authorization guard (must be a member). *(`GroupMembershipGuard`)*
- [x] **M1-17** Generate group invite link + `invitations` table. *(`Invitation` + token; `POST /groups/:id/invite`)*
- [x] **M1-18** Accept-invite endpoint. *(`POST /groups/join` with invite token; marks invitation accepted)*
- [x] **M1-19** Invite by email (enqueue email job, stubbed sender). *(`NotificationsProducer` + worker handler)*
- [x] **M1-20** Add/remove member endpoints with role checks. *(admin-only; remove is a soft-delete)*
- [x] **M1-21** Support guest (non-account) members in the data model. *(nullable `userId` + `guestName`)*
- [x] **M1-22** Mobile: create-group screen.
- [x] **M1-23** Mobile: group list + group detail screens.
- [x] **M1-24** Mobile: invite-member flow (native share of invite link).
- [x] **M1-25** Tests: group membership + authorization. *(service unit tests; verified via jest)*

---

## M2 — Core Expenses & Splitting

- [ ] **M2-01** Create `expenses` table (money as integer minor units) + migration.
- [ ] **M2-02** Create `expense_splits` table + migration.
- [ ] **M2-03** Create `activity_log` table + migration.
- [ ] **M2-04** Zod schemas for expense create/update in `packages/validation`.
- [ ] **M2-05** `POST /groups/:id/expenses` create expense (equal split).
- [ ] **M2-06** Add exact-amount split strategy.
- [ ] **M2-07** Add percentage split strategy.
- [ ] **M2-08** Add shares split strategy.
- [ ] **M2-09** Validation: splits must reconcile to the total (constraint + check).
- [ ] **M2-10** `PATCH /expenses/:id` edit with versioning.
- [ ] **M2-11** `DELETE /expenses/:id` soft-delete + log.
- [ ] **M2-12** Write activity-log entry on every expense mutation.
- [ ] **M2-13** `GET /groups/:id/expenses` paginated list.
- [ ] **M2-14** Pure balance engine: compute per-pair balances (unit-tested).
- [ ] **M2-15** Debt-minimization algorithm (unit-tested).
- [ ] **M2-16** `GET /groups/:id/balances` endpoint with Redis caching.
- [ ] **M2-17** Invalidate balance cache on expense mutation.
- [ ] **M2-18** WebSocket gateway: push balance/feed updates to group members.
- [ ] **M2-19** Mobile: quick add-expense form (amount, payer, split).
- [ ] **M2-20** Mobile: split-method selector UI (equal/exact/%/shares).
- [ ] **M2-21** Mobile: expense list screen.
- [ ] **M2-22** Mobile: expense detail + edit screen.
- [ ] **M2-23** Mobile: balances summary screen ("you owe / you're owed").
- [ ] **M2-24** Mobile: subscribe to WebSocket + invalidate React Query cache.
- [ ] **M2-25** Tests: split strategies + reconciliation edge cases.

---

## M3 — MVP Settlement & Release

- [ ] **M3-01** Create `payments` table (with idempotency_key, status) + migration.
- [ ] **M3-02** `POST /groups/:id/settlements` record manual settlement.
- [ ] **M3-03** Support partial settlement amounts + balance recompute.
- [ ] **M3-04** Reflect settlements in the activity log.
- [ ] **M3-05** Mobile: settle-up screen (who to pay, amount).
- [ ] **M3-06** Mobile: record-cash-payment flow.
- [ ] **M3-07** Create `comments` table + endpoints (add/list per expense).
- [ ] **M3-08** Mobile: activity feed screen.
- [ ] **M3-09** Mobile: per-expense comments UI.
- [ ] **M3-10** Notification dispatch service (resolve prefs → enqueue).
- [ ] **M3-11** Notification worker skeleton (consume queue).
- [ ] **M3-12** Push notification: new expense (FCM/APNs).
- [ ] **M3-13** Email notification: settle-up request (SendGrid template).
- [ ] **M3-14** Mobile: in-app notification list + badge.
- [ ] **M3-15** Beta build distribution (TestFlight / internal track).
- [ ] **M3-16** Smoke-test checklist for the end-to-end MVP flow.

---

## M4 — In-App Payments

- [ ] **M4-01** Stripe account + API keys in secrets management.
- [ ] **M4-02** Payment worker skeleton (consume payment jobs).
- [ ] **M4-03** Create payment intent endpoint (idempotent).
- [ ] **M4-04** Mobile: Stripe SDK integration + payment sheet.
- [ ] **M4-05** Handle Stripe webhooks (payment succeeded/failed).
- [ ] **M4-06** Update payment status + balances on webhook.
- [ ] **M4-07** Idempotency handling to prevent double-charge (test).
- [ ] **M4-08** Payment failure UX + retry path.
- [ ] **M4-09** Mobile: payment confirmation screen + receipt.
- [ ] **M4-10** Notification: payment confirmation (push + email).
- [ ] **M4-11** Reconciliation job: detect stuck/mismatched payments.
- [ ] **M4-12** Tests: payment lifecycle + webhook handling.

---

## M5 — Receipts, OCR & Multi-Currency

- [ ] **M5-01** Provision S3 bucket (private) + IAM policy via Terraform.
- [ ] **M5-02** Create `receipts` table + migration.
- [ ] **M5-03** Pre-signed upload URL endpoint.
- [ ] **M5-04** Mobile: capture/select receipt + upload to S3.
- [ ] **M5-05** Signed read-URL endpoint for viewing receipts.
- [ ] **M5-06** Object type/size validation + scan-before-available step.
- [ ] **M5-07** OCR worker skeleton (consume OCR jobs).
- [ ] **M5-08** Integrate OCR provider (Textract/Vision) call.
- [ ] **M5-09** Normalize extracted fields → `ocr_json`; set status.
- [ ] **M5-10** OCR retry/backoff + failure handling.
- [ ] **M5-11** Emit realtime event when OCR completes.
- [ ] **M5-12** Mobile: pre-fill expense form from OCR result.
- [ ] **M5-13** Itemized line-item split data model + endpoint.
- [ ] **M5-14** Mobile: itemized split UI.
- [ ] **M5-15** Currency-sync job (fetch FX rates → cache).
- [ ] **M5-16** Store expense currency + convert for display.
- [ ] **M5-17** Per-member display-currency preference.
- [ ] **M5-18** Mobile: currency selector + converted balances display.
- [ ] **M5-19** Tests: OCR pipeline states + multi-currency balances.

---

## M6 — Production Hardening

- [ ] **M6-01** Add rate limiting at the gateway (per-user/IP).
- [ ] **M6-02** Add structured audit logging for sensitive actions.
- [ ] **M6-03** Run dependency + container vulnerability scans in CI.
- [ ] **M6-04** OWASP review pass + fix critical/high findings (per finding ticket).
- [ ] **M6-05** Add OpenTelemetry tracing to API.
- [ ] **M6-06** Add tracing to each worker.
- [ ] **M6-07** Prometheus metrics + Grafana dashboards.
- [ ] **M6-08** Alerting on error rate + latency SLOs.
- [ ] **M6-09** Integrate Sentry (client + server).
- [ ] **M6-10** Load test core flows; record baselines.
- [ ] **M6-11** Query/index tuning for hot paths.
- [ ] **M6-12** Offline store + sync queue on mobile.
- [ ] **M6-13** Conflict reconciliation on reconnect (test).
- [ ] **M6-14** Notification preferences screen (per channel/type).
- [ ] **M6-15** Accessibility audit pass on core screens.
- [ ] **M6-16** Fix accessibility findings (per-screen tickets).
- [ ] **M6-17** GDPR/CCPA: data export endpoint + UI.
- [ ] **M6-18** GDPR/CCPA: account deletion flow.
- [ ] **M6-19** Backup + point-in-time-recovery verification.
- [ ] **M6-20** Graceful-degradation test (payment/OCR provider down).

---

## M7 — Public Launch

- [ ] **M7-01** App Store listing assets + metadata.
- [ ] **M7-02** Play Store listing assets + metadata.
- [ ] **M7-03** Submit iOS build for review.
- [ ] **M7-04** Submit Android build for review.
- [ ] **M7-05** Marketing landing page (web).
- [ ] **M7-06** Onboarding flow polish + empty states.
- [ ] **M7-07** Instrument success-metric analytics events.
- [ ] **M7-08** Analytics dashboard for activation/retention.
- [ ] **M7-09** Support tooling + help center stub.
- [ ] **M7-10** On-call runbook + escalation setup.
- [ ] **M7-11** Staged production rollout config.
- [ ] **M7-12** Post-launch monitoring checklist.

---

### Conventions

- IDs are stable; do not renumber. New work appends within a milestone.
- Any ticket exceeding ~2 hours should be split into sub-tickets (e.g. `M2-14a`, `M2-14b`).
- "Mobile" tickets imply matching web work where parity is required; create paired web tickets as web reaches parity.
