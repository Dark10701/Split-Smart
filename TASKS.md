# SplitSmart — Task Breakdown

**Version:** 1.0
**Last updated:** June 28, 2026
**Companion docs:** PRD.md, ARCHITECTURE.md, ROADMAP.md

Every ticket below is scoped to be completable in **under two hours**. Tickets are grouped by milestone (see ROADMAP.md) and prefixed with an ID. Check boxes track completion.

---

## M0 — Foundations

- [ ] **M0-01** Initialize git repo, license, README, and `.gitignore`.
- [ ] **M0-02** Set up pnpm workspace + Turborepo config.
- [ ] **M0-03** Add shared `packages/config` (eslint, prettier, tsconfig base).
- [ ] **M0-04** Scaffold `packages/types` with a placeholder shared type + build.
- [ ] **M0-05** Scaffold `packages/validation` with Zod and one sample schema.
- [ ] **M0-06** Scaffold `packages/ui` with a theme/token file.
- [ ] **M0-07** Scaffold NestJS app in `apps/api` with `/health` endpoint.
- [ ] **M0-08** Add Dockerfile for the API service.
- [ ] **M0-09** Write `docker-compose.yml` for Postgres + Redis locally.
- [ ] **M0-10** Add database client (Prisma/TypeORM) + initial connection config.
- [ ] **M0-11** Create initial migration (empty/baseline) and run it.
- [ ] **M0-12** Add Redis connection module to the API.
- [ ] **M0-13** Scaffold Expo mobile app in `apps/mobile` that boots.
- [ ] **M0-14** Scaffold Next.js web app in `apps/web` that boots.
- [ ] **M0-15** Wire mobile + web to call the `/health` endpoint.
- [ ] **M0-16** Add unit test harness (Jest/Vitest) with one passing test.
- [ ] **M0-17** Create GitHub Actions workflow: install + lint + typecheck.
- [ ] **M0-18** Extend CI to run tests and build all apps.
- [ ] **M0-19** Add Terraform skeleton in `infra/terraform` (no resources yet).
- [ ] **M0-20** Provision staging Postgres + Redis (managed) via Terraform.
- [ ] **M0-21** Add CD step to deploy API image to staging (Fargate/ECS).
- [ ] **M0-22** Document local setup in CONTRIBUTING/README.

---

## M1 — Auth & Groups

- [ ] **M1-01** Add auth provider (Auth0/Clerk) tenant + app config.
- [ ] **M1-02** Implement JWT validation guard in the API gateway layer.
- [ ] **M1-03** Create `users` table + migration.
- [ ] **M1-04** Implement "resolve/create internal user from token" service.
- [ ] **M1-05** Build `GET /me` profile endpoint.
- [ ] **M1-06** Build `PATCH /me` to update name + default currency.
- [ ] **M1-07** Add `notification_prefs` table + default seeding on signup.
- [ ] **M1-08** Mobile: email/password + Google login screen (provider SDK).
- [ ] **M1-09** Mobile: Apple sign-in integration.
- [ ] **M1-10** Mobile: token storage + refresh handling.
- [ ] **M1-11** Web: login + session handling.
- [ ] **M1-12** Create `groups` + `group_members` tables + migration.
- [ ] **M1-13** `POST /groups` create group endpoint.
- [ ] **M1-14** `GET /groups` list my groups endpoint.
- [ ] **M1-15** `GET /groups/:id` group detail with membership.
- [ ] **M1-16** Implement membership authorization guard (must be a member).
- [ ] **M1-17** Generate group invite link + `invitations` table.
- [ ] **M1-18** `POST /groups/:id/join` accept-invite endpoint.
- [ ] **M1-19** Invite by email (enqueue email job, stubbed sender).
- [ ] **M1-20** Add/remove member endpoints with role checks.
- [ ] **M1-21** Support guest (non-account) members in the data model.
- [ ] **M1-22** Mobile: create-group screen.
- [ ] **M1-23** Mobile: group list + group detail screens.
- [ ] **M1-24** Mobile: invite-member flow (share link).
- [ ] **M1-25** Tests: group membership + authorization.

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
