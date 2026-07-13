import { Worker } from 'bullmq';

const QUEUE_NAME = 'payments';
const url = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379');
const connection = {
  host: url.hostname,
  port: Number(url.port) || 6379,
  ...(url.password ? { password: url.password } : {}),
};

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    // Payment capture and webhook side effects are handled synchronously by the
    // API (idempotent). This worker owns out-of-band jobs: reconciliation sweeps
    // for stale pending intents (M4-11) enqueued by a scheduler.
    if (job.name === 'reconcile_stale') {
      console.log('[payments] reconciliation sweep requested');
      return { requested: true };
    }
    console.log(`[payments] received job ${job.id}`, job.name);
    return { handled: true };
  },
  { connection },
);

worker.on('ready', () => console.log(`[payments] worker ready on queue "${QUEUE_NAME}"`));
worker.on('failed', (job, err) => console.error(`[payments] job ${job?.id} failed`, err));

const shutdown = async (): Promise<void> => {
  await worker.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
