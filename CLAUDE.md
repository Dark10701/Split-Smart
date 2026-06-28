# CLAUDE.md

Guidance for Claude (and other AI assistants) when working in the **SplitSmart** repository.

## Project context

SplitSmart is a production-grade app for tracking and settling shared group expenses. Read these first when context is needed:

- `PRD.md` — product requirements, goals, users, features, acceptance criteria.
- `ARCHITECTURE.md` — system design, tech stack, and the reasoning behind each choice.
- `ROADMAP.md` — milestones from MVP to production.
- `TASKS.md` — the source of truth for granular work tickets.

When a request is ambiguous, infer intent from these documents before asking.

## Tech stack (do not change without an ADR)

TypeScript everywhere. React Native (Expo) mobile, Next.js web, NestJS backend, PostgreSQL, Redis, BullMQ workers, S3 storage, Stripe payments, OAuth/OIDC auth, AWS deployment. The repo is a pnpm + Turborepo monorepo (`apps/`, `workers/`, `packages/`, `infra/`).

## Core principles

- **Money is sacred.** Store amounts as integer minor units with an explicit currency — never floats. Every financial mutation must be versioned and auditable. Never silently lose an expense or payment. Payment operations must be idempotent.
- **The balance engine is pure.** Keep balance computation and debt-minimization side-effect-free and exhaustively unit-tested. Do not couple it to I/O.
- **Server-side authorization always.** Verify group membership and roles on every protected endpoint. Never trust the client.
- **Async for slow work.** OCR, notifications, payment capture, and FX sync run on workers via the queue — never in the request path.
- **Shared types.** Reuse `packages/types` and `packages/validation` (Zod) across client and server; do not duplicate contracts.

## Working conventions

- **Follow TASKS.md.** Implement work as discrete tickets. Keep each change small (a ticket should be completable in under two hours). If a task is larger, split it into sub-tickets rather than producing a sprawling change.
- **Match existing patterns.** Mirror the structure, naming, and style already present in the relevant module before introducing new approaches.
- **One concern per PR.** Keep diffs focused and reviewable.
- **Tests are required** for business logic — especially split strategies, the balance engine, payments, and authorization. Add/adjust tests in the same change as the code.
- **Migrations** accompany any schema change; never edit a shipped migration.
- **Secrets** never go in code or commits — use environment/secrets management.

## Definition of done

A change is done when it: implements the ticket; includes tests; passes lint, typecheck, and CI; updates relevant docs (including `TASKS.md` checkboxes); and introduces no critical/high security findings.

## What to avoid

- Storing money as floating point or omitting currency.
- Adding new dependencies or changing the stack without justification (an ADR via the architecture skill).
- Business logic in controllers/UI that belongs in services/the balance engine.
- Long-running or third-party calls in the synchronous request path.
- Broad, multi-concern changes that are hard to review.

## When unsure

Prefer the smallest correct change, state assumptions explicitly, and reference the relevant doc/ticket. If a decision has architectural weight (new technology, data-model change, service boundary), propose it as an ADR rather than implementing silently.
