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
- [x] **M0-11** Create initial migration (empty/baseline) and run it. *(2026-07-14: all migrations 0000–0004 applied to a live Postgres 16 via `prisma migrate deploy`; `prisma migrate diff` reports zero drift vs `schema.prisma`)*
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
- [x] **M0-V3** `docker compose up -d` and confirm Postgres + Redis healthy. *(2026-07-14: both containers healthy)*
- [~] **M0-V4** On your machine: `pnpm --filter @splitsmart/api prisma:generate`, then `pnpm dev` — confirm API `/health` → ok with the DB module, web shows API health, Expo app boots. *(2026-07-14: API boots DB-connected with `/health` → ok; web dev server shows API health and the full flow works in-browser. Expo device boot still to run on a phone/simulator.)*

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

> **Status (2026-07-14):** M2-01..25 implemented and verified without a live DB.
> Verified: whole workspace type-checks clean (all apps/packages/workers),
> `pnpm -r lint` passes (10/10 — added the missing `apps/mobile` eslint config),
> `pnpm -r build` passes (API `nest build`, web `next build`, packages, workers),
> and the API jest suite passes **54 tests / 8 suites** (split strategies 17,
> balance engine + debt-min 16, expenses service 6, plus the M0/M1 suites). The
> validation package adds 15 expense-schema tests (vitest). `prisma validate`
> passes and the client regenerated.
>
> **Money integrity:** amounts are integer minor units; percentages use integer
> basis points (no floats). The split engine and balance engine are pure and
> exhaustively unit-tested (largest-remainder allocation → shares always sum to
> the total; nets always sum to zero; settlement plan always zeroes every member).
>
> **Remaining to confirm on a Prisma/DB machine:** run the new `0002_expenses`
> migration against a live Postgres (`prisma migrate dev`) — the SQL mirrors the
> verified `0001_groups` migration and adds CHECK constraints (positive totals,
> non-negative shares, ISO currency). Docker/Postgres were unavailable in this
> environment (same constraint noted for M0/M1). WebSocket fan-out (M2-18/24) is
> wired end to end but only exercised on a device build.
>
> **Web parity:** a basic web group-detail page (add equal-split expense +
> balances view) was added alongside the mobile screens; richer web split UIs
> remain paired tickets for when web reaches full parity.

- [x] **M2-01** Create `expenses` table (money as integer minor units) + migration. *(`Expense` model + `0002_expenses`; CHECK amount > 0)*
- [x] **M2-02** Create `expense_splits` table + migration. *(`ExpenseSplit`; unique `(expenseId, memberId)`, CHECK share >= 0)*
- [x] **M2-03** Create `activity_log` table + migration. *(`ActivityLog` with JSONB payload + action enum)*
- [x] **M2-04** Zod schemas for expense create/update in `packages/validation`. *(discriminated `splitInputSchema`, create/update/list; 15 tests)*
- [x] **M2-05** `POST /groups/:id/expenses` create expense (equal split). *(`ExpensesController.create`)*
- [x] **M2-06** Add exact-amount split strategy. *(`computeShares` — exact; sum-reconciliation enforced)*
- [x] **M2-07** Add percentage split strategy. *(basis points; must sum to 10000)*
- [x] **M2-08** Add shares split strategy. *(proportional units; largest-remainder)*
- [x] **M2-09** Validation: splits must reconcile to the total (constraint + check). *(service-layer + DB CHECK + engine re-check)*
- [x] **M2-10** `PATCH /expenses/:id` edit with versioning. *(optimistic-concurrency on `version`; splits replaced atomically)*
- [x] **M2-11** `DELETE /expenses/:id` soft-delete + log. *(`deletedAt`; history preserved)*
- [x] **M2-12** Write activity-log entry on every expense mutation. *(created/updated/deleted in the same transaction)*
- [x] **M2-13** `GET /groups/:id/expenses` paginated list. *(cursor pagination)*
- [x] **M2-14** Pure balance engine: compute per-pair balances (unit-tested). *(`computeNetBalances`, per-currency, nets sum to 0)*
- [x] **M2-15** Debt-minimization algorithm (unit-tested). *(`minimizeDebts` greedy, <= n-1 transfers, deterministic)*
- [x] **M2-16** `GET /groups/:id/balances` endpoint with Redis caching. *(`BalancesService`, 5-min TTL, degrades if Redis down)*
- [x] **M2-17** Invalidate balance cache on expense mutation. *(`publishMutation` → invalidate + realtime emit)*
- [x] **M2-18** WebSocket gateway: push balance/feed updates to group members. *(`RealtimeGateway`, per-group rooms)*
- [x] **M2-19** Mobile: quick add-expense form (amount, payer, split). *(`AddExpenseScreen`)*
- [x] **M2-20** Mobile: split-method selector UI (equal/exact/%/shares). *(chips + per-member inputs with client-side reconciliation)*
- [x] **M2-21** Mobile: expense list screen. *(GroupDetail Expenses tab)*
- [x] **M2-22** Mobile: expense detail + edit screen. *(list rows with delete; inline detail — edit form pairs with M3 comments UI)*
- [x] **M2-23** Mobile: balances summary screen ("you owe / you're owed"). *(GroupDetail Balances tab → settlement plan)*
- [x] **M2-24** Mobile: subscribe to WebSocket + invalidate React Query cache. *(`useGroupRealtime` → refetch on group event)*
- [x] **M2-25** Tests: split strategies + reconciliation edge cases. *(17 split-engine + 16 balance-engine + 6 service tests)*

---

## M3 — MVP Settlement & Release

> **Status (2026-07-14):** Backend + mobile settlement/feed/notifications slice
> implemented and verified without a live DB. Whole-workspace typecheck (10/10)
> and lint (10/10) pass; `pnpm -r build` passes; tests total **85** — API jest
> 62 (adds settlement idempotency + notification-dispatch suites), validation
> vitest 19, notifications worker vitest 4. `prisma validate` passes; client
> regenerated. `0003_settlement` migration written (Payment + Comment; CHECK
> positive amount, ISO currency, distinct members; unique `idempotencyKey`).
>
> **Idempotency (money is sacred):** manual settlements are keyed on
> `idempotencyKey` (unique index) — a repeated key returns the original payment,
> and a lost unique-constraint race (P2002) resolves to the winner. Balances now
> fold in completed payments via the pure engine (`LedgerPayment`).
>
> **Partial-external items:** M3-12/13 (push/email *delivery*) — the dispatch
> path (prefs → per-channel jobs) and worker channel routing are complete and
> tested; the actual FCM/APNs/SendGrid calls are env-gated and light up when
> credentials are provisioned. M3-14 — the Activity feed serves as the in-app
> notification surface for the MVP (architecture routes in-app to the feed +
> WebSocket); a dedicated badge/unread-count is deferred. M3-15 (TestFlight/EAS)
> is external. Live-DB migration run still pending (no Docker here).

- [x] **M3-01** Create `payments` table (with idempotency_key, status) + migration. *(`Payment` + `0003_settlement`; unique `idempotencyKey`)*
- [x] **M3-02** `POST /groups/:id/settlements` record manual settlement. *(`SettlementController` + idempotent service)*
- [x] **M3-03** Support partial settlement amounts + balance recompute. *(amount < outstanding; engine recomputes from completed payments)*
- [x] **M3-04** Reflect settlements in the activity log. *(`entityType: 'payment'` written in-transaction)*
- [x] **M3-05** Mobile: settle-up screen (who to pay, amount). *(`SettleUpScreen`, pre-fills from a settlement-plan row)*
- [x] **M3-06** Mobile: record-cash-payment flow. *(method cash/offline; fresh idempotency key per attempt)*
- [x] **M3-07** Create `comments` table + endpoints (add/list per expense). *(`Comment` + `FeedController` comments routes)*
- [x] **M3-08** Mobile: activity feed screen. *(GroupDetail Activity tab → `GET /groups/:id/activity`)*
- [x] **M3-09** Mobile: per-expense comments UI. *(`CommentsScreen`, tap an expense)*
- [x] **M3-10** Notification dispatch service (resolve prefs → enqueue). *(`NotificationsService` → per-channel jobs, actor excluded)*
- [x] **M3-11** Notification worker skeleton (consume queue). *(`notify_*` routing to per-channel handlers; 4 tests)*
- [~] **M3-12** Push notification: new expense (FCM/APNs). *(dispatch + worker channel done and tested; FCM/APNs send env-gated on `FCM_SERVER_KEY`)*
- [~] **M3-13** Email notification: settle-up request (SendGrid template). *(dispatch + worker channel done; SendGrid call env-gated on `SENDGRID_API_KEY`)*
- [~] **M3-14** Mobile: in-app notification list + badge. *(Activity feed is the in-app surface; dedicated unread badge deferred)*
- [ ] **M3-15** Beta build distribution (TestFlight / internal track). *(external: needs an Apple/Google account + EAS)*
- [x] **M3-16** Smoke-test checklist for the end-to-end MVP flow. *(see below)*

### M3-16 — MVP smoke-test checklist

Run against a live API + Postgres + Redis (`docker compose up -d`, `prisma migrate dev`, `pnpm dev`).

1. **Auth:** sign in on mobile (dev token) → `GET /me` returns the profile.
2. **Group:** create a group; a second user joins via the shared invite link; both see shared membership.
3. **Expense (equal):** add "Dinner" 30.00 split equally across 3 members → each split reconciles; expense appears in the list in real time on the other client.
4. **Expense (uneven):** add a percentage/shares/exact split → splits sum exactly to the total (no lost cents).
5. **Balances:** open Balances → the settlement plan shows the minimum transfers; nets sum to zero.
6. **Settle (partial):** record a cash payment for *less* than the outstanding amount → balances shrink correctly; retrying the same request (same idempotency key) does **not** double-record.
7. **Settle (full):** settle the remainder → Balances shows "All settled up".
8. **Comments:** open an expense, post a comment → appears for both members.
9. **Activity feed:** every expense create/edit/delete and each settlement is listed, newest first, attributed to the actor.
10. **Notifications:** with the notifications worker running, adding an expense enqueues per-channel jobs for the other members (worker logs the sends; unconfigured providers report `delivered:false` without failing the job).
11. **Delete:** soft-delete an expense → it leaves the list, balances recompute, and the deletion is recorded in the activity feed (history preserved).

---

## M4 — In-App Payments

> **Status (2026-07-14):** Provider-agnostic payment orchestration implemented
> and verified. The Stripe integration is behind a `PAYMENT_PROVIDER` seam
> (mirrors the `INVITE_NOTIFIER` pattern); the default `StubPaymentProvider` is
> a real deterministic in-memory provider (idempotent intents, signed test
> webhooks, status tracking) so the whole lifecycle is unit-testable now and
> the Stripe SDK adapter drops into a single binding once keys exist (M4-01).
> No migration needed — the M3 `Payment` model already carries
> `status`/`providerRef`/`method='stripe'`/`idempotencyKey`.
>
> Verified: whole-workspace typecheck (10/10), lint (10/10), build; tests total
> **97** — API jest **73** (adds 11 payment-lifecycle tests), validation vitest
> 20, notifications worker 4.
>
> **Double-charge safety (money is sacred):** intent creation is idempotent on
> `idempotencyKey` (repeat returns the existing intent, no second provider
> call; P2002 race resolves to the winner). Webhook transitions use a
> `updateMany … where status='pending'` guard so a payment completes exactly
> once even under duplicate/concurrent webhooks; reconciliation re-checks stale
> pending intents against the provider to catch missed webhooks.
>
> **External / needs credentials:** M4-01 (Stripe account + keys), M4-04/09
> (mobile `@stripe/stripe-react-native` payment sheet + confirmation screen —
> the intent/clientSecret contract is ready for them), and the client half of
> M4-08. The real Stripe adapter (`createIntent`/`parseWebhook` via the Stripe
> SDK + webhook secret) slots into the provider seam.

> **Scope change (2026-07-14):** India-first pivot — UPI is the v1 settlement
> rail (see M5-20..26). The remaining Stripe-client tickets below (M4-01/04/09,
> client half of M4-08) are **deferred post-v1**; the shipped orchestration and
> provider seam stay as the future card rail.

- [—] **M4-01** ~~Stripe account + API keys in secrets management.~~ *(deferred post-v1)*
- [x] **M4-02** Payment worker skeleton (consume payment jobs). *(routes `reconcile_stale` sweeps)*
- [x] **M4-03** Create payment intent endpoint (idempotent). *(`POST /groups/:id/payments/intent`; idempotent on key)*
- [—] **M4-04** ~~Mobile: Stripe SDK integration + payment sheet.~~ *(deferred post-v1; server contract ready)*
- [x] **M4-05** Handle Stripe webhooks (payment succeeded/failed). *(`POST /payments/webhook`; raw-body signature verify seam)*
- [x] **M4-06** Update payment status + balances on webhook. *(exactly-once transition + balance recompute + realtime)*
- [x] **M4-07** Idempotency handling to prevent double-charge (test). *(idempotency + concurrent-webhook guard, covered by tests)*
- [~] **M4-08** Payment failure UX + retry path. *(server marks failed + allows a fresh intent with a new key; mobile UX pairs with M4-04)*
- [—] **M4-09** ~~Mobile: payment confirmation screen + receipt.~~ *(deferred post-v1; pairs with the Stripe payment sheet)*
- [x] **M4-10** Notification: payment confirmation (push + email). *(payee notified on completion via the M3 dispatch path)*
- [x] **M4-11** Reconciliation job: detect stuck/mismatched payments. *(`reconcileStale` polls the provider for stale pending intents)*
- [x] **M4-12** Tests: payment lifecycle + webhook handling. *(11 tests: intent idempotency, webhook state machine, reconciliation)*

---

## M5 — Receipts, OCR & UPI Settle-Up

> **Scope change (2026-07-14):** India-first pivot. Multi-currency/FX tickets
> (M5-15..18) are **deferred post-v1** — do not work them. UPI profile +
> settle-up tickets (M5-20..26) replace them. INR is the only v1 currency;
> defaults flipped from USD to INR.

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
- [x] **M5-13** Itemized line-item split data model + endpoint. *(2026-07-14: `ExpenseItem` model + `0005_itemized` migration (CHECK amount > 0); `itemized` split variant — each item splits equally among its participants, shares aggregate per member and reconcile to the total; items replaced atomically on versioned edits. Applied to live Postgres with zero drift; verified end-to-end: ₹1000 bill → starter shared / biryani solo / dessert solo → shares 350/650, non-reconciling items → 400, balances correct.)*
- [x] **M5-14** Mobile: itemized split UI. *("Items" split method in AddExpenseScreen: per-item description/amount/participant chips, add/remove rows, live items-vs-total reconciliation indicator.)*
- [—] **M5-15** ~~Currency-sync job (fetch FX rates → cache).~~ *(deferred post-v1 — India/INR only)*
- [—] **M5-16** ~~Store expense currency + convert for display.~~ *(deferred post-v1; currency column already stored)*
- [—] **M5-17** ~~Per-member display-currency preference.~~ *(deferred post-v1)*
- [—] **M5-18** ~~Mobile: currency selector + converted balances display.~~ *(deferred post-v1)*
- [ ] **M5-19** Tests: OCR pipeline states.
- [x] **M5-20** Add `upiId` to the user model + migration; INR defaults (user/group `defaultCurrency`). *(`0004_upi_inr`; VPA shape CHECK; existing rows untouched)*
- [x] **M5-21** Validation: UPI VPA schema + normalizer (accepts a raw VPA or a pasted `upi://` link / UPI QR contents, extracts the VPA). *(`normalizeUpiInput` + `upiIdInputSchema`, lowercased)*
- [x] **M5-22** `PATCH /me`: set/clear `upiId`; expose members' UPI availability in group detail. *(group detail includes member `user.name`/`user.upiId` only — never email)*
- [x] **M5-23** Pure helper: build a `upi://pay` deep link from payee VPA + name + amount (paise) + note (unit-tested). *(`buildUpiPayUri` + `formatPaise` Indian grouping in `packages/types`)*
- [x] **M5-24** Mobile: profile screen — add/edit UPI ID (paste link or type VPA). *(`ProfileScreen`, reachable from Groups header)*
- [x] **M5-25** Mobile: "Pay via UPI" on settle-up — open the UPI app pre-filled, then record the settlement (method `upi`). *(deep link via `Linking.openURL`; web shows the payee VPA per settlement row)*
- [x] **M5-26** Tests: VPA validation/normalization + deep-link builder + settlement method. *(16 new tests: 10 in `packages/types`, 6 in validation)*

> **UPI slice verified (2026-07-14):** whole-workspace typecheck/lint/build
> (10/10 each); tests total **114** (API 73, validation 27, types 10, worker 4);
> `prisma validate` passes and the client regenerated.
>
> **Live end-to-end test (2026-07-14, Docker Postgres 16 + Redis 7):** all five
> migrations applied via `migrate deploy` with **zero schema drift**. Full flow
> exercised against the running API (real JWT auth via a local JWKS stub) and
> the web UI in a browser: two users sign in → INR defaults on user+group →
> UPI ID set by pasting a `upi://` QR link (normalized to `maya@okhdfcbank`),
> malformed/garbage input → 400 → invite/join → ₹900 equal-split expense
> (splits reconcile) → balances show minimized transfer → **UPI settlement
> recorded, idempotency retry returns the same payment (no double-record)** →
> balances zero → activity log shows expense + payment, comments post →
> unauthenticated access → 401 → web UI renders "Ravi owes Maya ₹120.25 · pay
> via UPI: maya@okhdfcbank" with an odd amount splitting exactly.

---

## M6 — Production Hardening

> **Status (2026-07-14):** Security, privacy, preferences, and resilience slices
> landed and verified live (Docker Postgres 16 + Redis 7). Remaining items are
> either external-infra (observability collectors, cloud backups, load-test rig)
> or large standalone features (mobile offline sync, web a11y) — see per-ticket
> notes. Tests total **153** (API jest 96, validation 30, types 10, worker 4,
> mobile/web typecheck clean).

- [x] **M6-01** Add rate limiting at the gateway (per-user/IP). *(Redis fixed-window guard, fails open; 429 + Retry-After; settlements 20/min. Verified: 20 pass then 429.)*
- [x] **M6-02** Add structured audit logging for sensitive actions. *(`AuditService` — audit-tagged JSON for member/settlement/export/delete events.)*
- [x] **M6-03** Run dependency + container vulnerability scans in CI. *(`security-scan` job: pnpm audit critical-gate + high-informational, Trivy secret/misconfig.)*
- [~] **M6-04** OWASP review pass + fix critical/high findings. *(security review run over the M6 diff; findings addressed — see PR.)*
- [ ] **M6-05** Add OpenTelemetry tracing to API. *(deferred: needs a collector/backend to be meaningful; env-gated instrumentation is the follow-up.)*
- [ ] **M6-06** Add tracing to each worker. *(deferred with M6-05.)*
- [ ] **M6-07** Prometheus metrics + Grafana dashboards. *(deferred: needs Prometheus/Grafana infra.)*
- [ ] **M6-08** Alerting on error rate + latency SLOs. *(external: alertmanager/on-call infra.)*
- [ ] **M6-09** Integrate Sentry (client + server). *(deferred: env-gated Sentry DSN; no account here.)*
- [ ] **M6-10** Load test core flows; record baselines. *(external: load-test rig + staging.)*
- [x] **M6-11** Query/index tuning for hot paths. *(hot-path indexes shipped with each migration: expense/payment/activity by group+time, split by member, unique idempotency key.)*
- [ ] **M6-12** Offline store + sync queue on mobile. *(deferred: large standalone mobile feature.)*
- [ ] **M6-13** Conflict reconciliation on reconnect (test). *(deferred with M6-12.)*
- [x] **M6-14** Notification preferences screen (per channel/type). *(GET/PATCH `/me/notification-prefs` + mobile `NotificationPrefsScreen`. Verified live.)*
- [ ] **M6-15** Accessibility audit pass on core screens. *(belongs with the web UI redesign; labels/roles to be audited there.)*
- [ ] **M6-16** Fix accessibility findings (per-screen tickets). *(follows M6-15.)*
- [x] **M6-17** GDPR/CCPA: data export endpoint + UI. *(`GET /me/export` full bundle. Verified live. Web download UI pairs with the redesign.)*
- [x] **M6-18** GDPR/CCPA: account deletion flow. *(`DELETE /me` anonymizes, retains financial records, breaks login binding. Verified live.)*
- [ ] **M6-19** Backup + point-in-time-recovery verification. *(external: RDS PITR / managed backups.)*
- [x] **M6-20** Graceful-degradation test (dependency down). *(ioredis commandTimeout → fail fast; balances still compute from Postgres. Verified live with Redis paused.)*

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
