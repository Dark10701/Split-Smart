import { Worker } from 'bullmq';

const QUEUE_NAME = 'notifications';
const url = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379');
const connection = {
  host: url.hostname,
  port: Number(url.port) || 6379,
  ...(url.password ? { password: url.password } : {}),
};

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    console.log(`[notifications] received job ${job.id}`, job.name);
    return { handled: true };
  },
  { connection },
);

worker.on('ready', () => console.log(`[notifications] worker ready on queue "${QUEUE_NAME}"`));
worker.on('failed', (job, err) => console.error(`[notifications] job ${job?.id} failed`, err));

const shutdown = async (): Promise<void> => {
  await worker.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
