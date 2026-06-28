# Workers

BullMQ workers that handle slow / external work off the request path (per `ARCHITECTURE.md`):

- `ocr/` — receipt OCR extraction.
- `notifications/` — push / email / SMS dispatch.
- `payments/` — payment capture and reconciliation.
- `currency-sync/` — periodic FX rate refresh.

Each worker is a standalone package that connects to Redis (the BullMQ broker) and processes a named queue. In Milestone 0 these are **skeletons** — they boot, connect, and register a processor, but business logic is added in later milestones per `TASKS.md`.

Run an individual worker in dev:

```bash
pnpm --filter @splitsmart/worker-notifications dev
```
