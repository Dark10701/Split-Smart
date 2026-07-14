# SplitSmart — Roadmap

**Version:** 1.1
**Last updated:** July 14, 2026
**Companion docs:** PRD.md, ARCHITECTURE.md

> **v1.1 (2026-07-14):** India-first pivot — INR only, UPI-first settlement.
> M4's card/Stripe client work is deferred post-v1 (its provider-agnostic
> orchestration shipped and stays); M5 drops multi-currency/FX and gains
> **UPI profile + settle-up** instead.

This roadmap breaks SplitSmart into sequential milestones from a usable MVP to a production launch and beyond. Each milestone has a clear goal, scope, and exit criteria. Timeframes are indicative for a small team (3–5 engineers) and should be treated as relative, not committed dates.

---

## Milestone 0 — Foundations *(≈1–2 weeks)*

**Goal:** A working skeleton that everything else builds on.

**Scope**
- Monorepo setup (pnpm + Turborepo), shared `types`/`validation`/`ui` packages.
- Backend skeleton (NestJS), database (Postgres) with migrations, Redis.
- CI/CD pipeline, linting, formatting, test harness.
- Local dev environment via Docker Compose.
- Base mobile (Expo) and web (Next.js) apps that boot and call a health endpoint.

**Exit criteria:** A developer can clone, run all apps locally, and ship a trivial change through CI to a staging environment.

---

## Milestone 1 — Auth & Groups *(≈2 weeks)*

**Goal:** Users can sign up and form groups.

**Scope**
- OAuth/OIDC integration (email + Google + Apple), session/token handling.
- User profile and preferences.
- Create group, invite via link, join group, roles (admin/member), guests.
- Membership management (add/remove, preserving history).

**Exit criteria:** A user can register, create a group, invite a second user, and both see shared membership.

---

## Milestone 2 — Core Expenses & Splitting (MVP core) *(≈2–3 weeks)*

**Goal:** The heart of the product — log and split expenses.

**Scope**
- Add/edit/delete expense (amount, payer, participants, category, date).
- Split strategies: equal, exact, percentage, shares.
- Versioned expenses + activity log.
- Deterministic balance engine + debt-minimization.
- Real-time per-member and per-group balances.

**Exit criteria:** A group can record varied expenses and see accurate, simplified balances update in real time.

---

## Milestone 3 — MVP Settlement & Release *(≈2 weeks)*

**Goal:** Close the loop — people can settle up. First usable release.

**Scope**
- Record manual (offline) settlements; partial payments.
- Activity feed and per-expense comments.
- Basic push + email notifications (new expense, settle-up).
- Internal/beta release to a small group of real users.

**Exit criteria (MVP):** A real group can run their shared expenses end to end — add, split, view balances, and settle manually — in a beta build.

---

## Milestone 4 — Payment Orchestration *(≈2–3 weeks)* — ✅ shipped (card client deferred)

**Goal:** Idempotent payment infrastructure with a clean provider seam.

**Scope**
- Provider-agnostic payment-intent orchestration (idempotent), webhook status machine, reconciliation job. *(Shipped.)*
- ~~Stripe SDK client + payment sheet~~ → **deferred post-v1** (UPI is the v1 settlement rail; the Stripe adapter drops into the existing provider seam when needed).

**Exit criteria (met for the shipped scope):** payment lifecycle is idempotent — no double-charges under retry or duplicate webhooks.

---

## Milestone 5 — Receipts, OCR & UPI Settle-Up *(≈2–3 weeks)*

**Goal:** Reduce entry friction and make settling as easy as any UPI payment.

**Scope**
- **UPI profile:** user adds a UPI ID — typed, or extracted from a pasted `upi://` link / UPI QR contents; validated and stored on the account.
- **UPI settle-up:** "Pay via UPI" on any owed balance opens the payer's UPI app with payee VPA + amount pre-filled; the payment is then recorded (idempotent) like a manual settlement.
- Receipt capture + S3 pre-signed upload.
- Async OCR pipeline; pre-filled expense forms from extracted data.
- Itemized line-item splitting.
- ~~Multi-currency expenses with live FX~~ → **post-v1** (INR only).

**Exit criteria:** A user with a UPI ID on their profile can be paid by any group member in two taps (UPI app opens pre-filled, settlement recorded); a user can photograph a receipt and get a pre-filled, itemized expense.

---

## Milestone 6 — Production Hardening *(≈2–3 weeks)*

**Goal:** Make it safe, fast, and reliable at scale.

**Scope**
- Security review (OWASP), rate limiting, audit logging.
- Performance/load testing to targets; caching and query tuning.
- Observability: tracing, metrics, alerting, dashboards, error tracking.
- Offline support + sync reconciliation hardening.
- Accessibility (WCAG 2.1 AA) and full notification preferences.
- GDPR/CCPA flows: data export and deletion.

**Exit criteria:** All non-functional requirements in the PRD are met and verified; no critical/high security findings.

---

## Milestone 7 — Public Launch *(≈1–2 weeks)*

**Goal:** Ship to the world.

**Scope**
- App Store / Play Store submission and approval.
- Marketing site, onboarding polish, support tooling.
- Analytics and success-metric instrumentation.
- Staged rollout and on-call readiness.

**Exit criteria:** SplitSmart is publicly available on iOS, Android, and web, meeting uptime and performance SLOs with monitoring in place.

---

## Post-Launch — Growth & Expansion *(ongoing)*

Prioritized from the PRD's future features:

- Multi-currency + live FX (international expansion).
- In-app card payments (Stripe) via the existing provider seam; UPI TPAP integration for verified payment status.
- Recurring expenses & subscriptions.
- Bank/card linking with smart transaction import.
- AI receipt scanning improvements and category prediction.
- Group budgets, spending insights, and shared savings pots.
- Smart adaptive reminders and deeper integrations.
- Premium tier and monetization.

---

## Milestone Summary

| # | Milestone | Outcome |
|---|---|---|
| 0 | Foundations | Skeleton + CI/CD |
| 1 | Auth & Groups | Users + groups |
| 2 | Core Expenses | Logging + balances |
| 3 | MVP Settlement | **Usable MVP (beta)** |
| 4 | Payment Orchestration | Idempotent payment infra (card client deferred) |
| 5 | Receipts/OCR/UPI | Low-friction entry + UPI settle-up |
| 6 | Hardening | Meets NFRs |
| 7 | Public Launch | **GA on all platforms** |
| — | Growth | Future features |
