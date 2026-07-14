# SplitSmart — Product Requirements Document

**Version:** 1.1
**Status:** Draft
**Last updated:** July 14, 2026
**Owner:** Product

> **v1.1 scope change (2026-07-14):** SplitSmart v1 is **India-first**. All money
> is INR; multi-currency support moves to post-v1. In its place, v1 adds
> **UPI-based settlement**: a user can add their UPI ID (or paste a `upi://`
> link / their UPI QR's contents) to their profile, and anyone who owes them can
> settle through any UPI app with the amount pre-filled, then record the payment
> in SplitSmart. UPI is the primary settlement rail; card-based in-app payments
> (Stripe) are deferred.

---

## 1. Overview

SplitSmart is a mobile-first application that lets groups of people track shared expenses, split costs fairly, and settle up with minimal friction. It targets the everyday problem of "who owes whom" across roommates, trips, couples, and social groups — replacing spreadsheets, group-chat math, and awkward reminders with an automated, transparent ledger.

The product is designed to be production-ready: secure, reliable, performant at scale, and compliant with payment and privacy regulations.

---

## 2. Goals

The primary goals for SplitSmart are:

- **Eliminate friction in shared spending.** Make it trivial to record an expense, split it any way, and know exactly what each person owes in real time.
- **Drive settlement.** Reduce the time and effort between an expense being logged and balances being settled, including optional in-app payment.
- **Build trust through transparency.** Every member can see a complete, auditable history of expenses, splits, and payments.
- **Support real-world group dynamics.** Handle unequal splits, recurring costs, and partial payments without forcing users into rigid models.
- **Achieve sustainable growth.** Reach product-market fit with strong retention and organic, network-driven user acquisition.

### Non-goals (for v1)

- Full personal-finance management or budgeting beyond shared expenses.
- Acting as a money-transmitter / holding user funds (settlement happens directly between users over UPI, or offline).
- Business accounting, invoicing, or tax preparation.
- Multi-currency support and markets outside India (post-v1).
- Card-based in-app payment processing (Stripe) — deferred; UPI is the v1 settlement rail.

---

## 3. Target Users

| Segment | Description | Core need |
|---|---|---|
| **Roommates** | People sharing rent, utilities, and household supplies on an ongoing basis. | Recurring bills, persistent balances, fair allocation. |
| **Travelers** | Friends or family splitting costs on a trip within India. | Quick entry on the go, settle-up at the end via UPI. |
| **Couples** | Partners managing shared and personal expenses. | Simple ongoing ledger, privacy, flexible splits. |
| **Social groups** | Friends splitting dinners, events, gifts, subscriptions. | One-off splits, easy reminders, low setup cost. |

**Primary persona — "Maya, 27, urban renter in Bengaluru":** Tech-comfortable, pays for everything over UPI, splits rent and groceries with two roommates and frequently covers group dinners. Wants to stop fronting money and chasing people, and wants the math handled automatically — with settle-up as easy as any other UPI payment.

---

## 4. Features

### 4.1 Core (v1)

**Group & member management.** Create groups, invite members via link/email/phone, assign roles (admin, member), and manage membership. Support guest members who don't yet have an account.

**Expense entry.** Add an expense with amount, payer, description, category, date, and optional receipt photo. Quick-add flow optimized for under-10-second entry.

**Flexible splitting.** Split equally, by exact amounts, by percentage, by shares, or by itemized line items. Exclude members from specific expenses.

**Real-time balances.** Continuously computed per-member and per-group balances showing who owes whom, with simplified "debt minimization" so the fewest transactions settle the group.

**Settlement via UPI.** Every user can add their **UPI ID** to their profile — typed directly, or by pasting a `upi://` payment link or the contents of their UPI QR. When someone owes them, SplitSmart shows a "Pay via UPI" action that opens any UPI app (GPay, PhonePe, Paytm, BHIM…) with payee and amount pre-filled; the payer then records the settlement in SplitSmart. Manual (cash/offline) settlements and partial payments are also supported.

**Activity feed & history.** Chronological, auditable log of all expenses, edits, and payments, with comments per expense.

**Notifications.** Push, email, and in-app notifications for new expenses, settle-up requests, reminders, and payment confirmations.

**INR everywhere.** All amounts are Indian Rupees, stored as integer paise. (Multi-currency is a post-v1 feature; the data model keeps an explicit currency code so it can be added without a rewrite.)

### 4.2 Supporting

- Receipt capture and attachment.
- Expense categories and per-group spending summaries.
- Search and filtering across expenses.
- Export to CSV/PDF.
- Light/dark theme and accessibility support.

---

## 5. User Stories

**Group setup**
- As a user, I want to create a group and invite people by link so we can start tracking shared costs quickly.
- As an admin, I want to remove a member and have balances remain intact so historical accuracy is preserved.

**Logging expenses**
- As a user, I want to add an expense in a few taps so I don't avoid recording small costs.
- As a user, I want to split an expense unequally so it reflects what each person actually consumed.
- As a user, I want to attach a receipt so others can verify the charge.

**Understanding balances**
- As a user, I want to see at a glance what I owe and what I'm owed so there's no ambiguity.
- As a user, I want the app to minimize the number of payments needed so settling is simple.

**Settling up**
- As a user, I want to add my UPI ID (or paste my UPI QR link) to my profile once so anyone who owes me can pay me directly.
- As a user, I want to tap "Pay via UPI" on a balance and land in my UPI app with the payee and amount pre-filled so settling takes seconds.
- As a user, I want to record a cash payment so offline settlements stay in sync.
- As a user, I want to send a gentle reminder so I don't have to chase people manually.

**Trust & transparency**
- As a user, I want to see who added or edited an expense so the ledger is trustworthy.
- As a user, I want to comment on an expense so I can question or clarify a charge.

---

## 6. Non-Functional Requirements

**Performance.** Core screens load in under 1.5s on a median mobile device and 4G. Expense creation and balance recalculation reflect within 500ms. Support groups of up to 100 members and 10,000 expenses without degradation.

**Scalability.** Architecture supports horizontal scaling to 1M+ monthly active users with stateless services and a partitioned data layer.

**Availability.** 99.9% uptime target for core services. Graceful degradation when payment providers are unavailable (expenses still log; settlement queues).

**Reliability & data integrity.** All financial calculations are deterministic and auditable. No expense or payment is ever silently lost; every mutation is versioned. Idempotent payment operations prevent double-charging.

**Security.** Encryption in transit (TLS 1.2+) and at rest. OWASP Top 10 mitigations, rate limiting, and audit logging. Authentication via OAuth/social login and email; optional 2FA. No raw payment credentials stored — handled by PCI-compliant processor.

**Privacy & compliance.** GDPR and CCPA compliant: data export, deletion, and consent flows. Clear data-retention policy. Financial data isolated per user with strict access control.

**Offline support.** Users can log expenses offline; entries sync and reconcile on reconnect.

**Accessibility.** WCAG 2.1 AA conformance — screen-reader support, sufficient contrast, scalable text, full keyboard navigation on web.

**Localization.** India-first: INR-only amounts with Indian digit grouping (₹1,23,456.78), and a multi-language framework ready for Indian languages. (Multi-currency is post-v1.)

**Observability.** Centralized logging, metrics, distributed tracing, and alerting on error rate and latency SLOs.

---

## 7. Success Metrics

| Category | Metric | Target |
|---|---|---|
| Activation | % of new users who join/create a group and log first expense within 24h | ≥ 60% |
| Engagement | Weekly active users / monthly active users | ≥ 45% |
| Core action | Expenses logged per active group per week | ≥ 5 |
| Settlement | % of outstanding balances settled within 30 days | ≥ 70% |
| Retention | Day-30 retention | ≥ 35% |
| Growth | Viral coefficient (invites that convert to active users) | ≥ 0.5 |
| Reliability | Core service uptime | ≥ 99.9% |
| Satisfaction | App store rating | ≥ 4.5 |
| Performance | p95 expense-entry latency | < 500ms |

---

## 8. Assumptions

- Users have a smartphone with internet connectivity for most actions; brief offline use is supported.
- Most group members will adopt the app once invited (network effect drives growth).
- Users have at least one UPI app installed and a UPI ID; UPI deep links (`upi://pay`) open the user's UPI app with payee/amount pre-filled.
- SplitSmart never initiates or captures the UPI transaction itself — it hands off to the user's UPI app and records the settlement the user confirms, so no PSP/PA licensing is required for v1.
- Users are willing to grant notification and (optionally) contacts permissions.
- v1 launches in India only (INR, UPI rails, Indian data-privacy regime — DPDP Act).

---

## 9. Future Features (Post-v1)

- **Multi-currency** expenses with live FX and per-member display currency (international expansion).
- **In-app card payments** via a PCI-compliant processor (Stripe) where UPI isn't an option.
- **UPI deep-link verification** (collect requests / payment status callbacks via a UPI TPAP partnership).
- **Recurring expenses & subscriptions** with automatic monthly posting.
- **Bank / card linking** to auto-import and suggest shared transactions.
- **AI receipt scanning** to auto-extract line items and assign splits.
- **Budgets and spending insights** at the group level.
- **Shared savings goals / group pots** for trips and events.
- **Web and desktop clients** with full feature parity.
- **Smart reminders** with adaptive timing and escalation.
- **Integrations** with calendars, travel apps, and messaging platforms.
- **Premium tier** (advanced reports, unlimited groups, priority support).

---

## 10. Acceptance Criteria

The release is considered ready when the following are met:

**Groups & members**
- A user can create a group, invite members via link/email, and members appear once they join.
- Removing a member preserves all historical balances and records.

**Expenses & splitting**
- An expense can be created with amount, payer, participants, and a split method (equal, exact, percentage, shares, itemized); the sum of splits always reconciles to the total.
- Editing or deleting an expense recalculates balances correctly and records the change in history.
- Receipts can be attached and viewed.

**Balances & settlement**
- Per-member and per-group balances are accurate and update within 500ms of any change.
- Debt simplification produces the minimum set of transactions to settle a group.
- A user can add a UPI ID to their profile by typing it or pasting a `upi://` link / UPI QR contents; invalid VPAs are rejected.
- Tapping "Pay via UPI" on a balance opens a UPI app with the payee's VPA and the exact amount pre-filled, and the payer can record the settlement immediately after.
- A user can record a manual settlement; partial payments update balances correctly and every settlement write is idempotent (no double-record).

**Transparency & notifications**
- Every expense, edit, and payment is visible in an auditable activity feed attributed to the actor.
- Users receive notifications for new expenses, reminders, and payment confirmations per their preferences.

**Non-functional**
- Core flows meet stated latency and uptime targets under load testing.
- Security review passes (no critical/high OWASP findings); data export and deletion flows function.
- Offline expense entry syncs correctly on reconnect with no data loss.
- Accessibility audit passes WCAG 2.1 AA on core flows.

---

*End of document.*
