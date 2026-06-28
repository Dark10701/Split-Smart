# Contributing to SplitSmart

## Local setup

1. Install Node >= 20 and pnpm >= 9 (`corepack enable`).
2. `pnpm install`
3. `cp .env.example .env`
4. `docker compose up -d` to start Postgres + Redis.
5. `pnpm dev` to run all apps.

## Workflow conventions

- **Follow `TASKS.md`.** Implement work as discrete tickets, each completable in under two hours. Split larger work into sub-tickets.
- **One concern per PR.** Keep diffs focused and reviewable.
- **Tests are required** for business logic (split strategies, balance engine, payments, authorization).
- **Migrations** accompany any schema change; never edit a shipped migration.
- **Secrets** never go in code or commits — use `.env` / secrets management.
- Run `pnpm lint`, `pnpm typecheck`, and `pnpm test` before opening a PR. CI runs the same.

## Commit messages

Conventional commits are encouraged, e.g. `feat(expenses): add percentage split strategy`.

## Definition of done

A change is done when it implements the ticket, includes tests, passes lint/typecheck/CI, updates relevant docs (including `TASKS.md` checkboxes), and introduces no critical/high security findings.
