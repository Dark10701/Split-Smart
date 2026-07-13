import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import type { InviteNotifier } from './invite-notifier';
import type { NotificationDispatcher, NotificationJob } from './notification-dispatch';

/**
 * Enqueues notification jobs onto the shared "notifications" queue. Slow work
 * (actually sending the email/push) happens in the notifications worker.
 */
@Injectable()
export class NotificationsProducer
  implements InviteNotifier, NotificationDispatcher, OnModuleDestroy
{
  private readonly logger = new Logger(NotificationsProducer.name);
  private readonly queue: Queue;

  constructor(config: ConfigService) {
    const url = new URL(config.get<string>('REDIS_URL') ?? 'redis://localhost:6379');
    this.queue = new Queue('notifications', {
      connection: {
        host: url.hostname,
        port: Number(url.port) || 6379,
        ...(url.password ? { password: url.password } : {}),
      },
    });
  }

  async sendInvite(input: { email: string; token: string; groupId: string }): Promise<void> {
    await this.queue.add('invite_email', input, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: true,
    });
    this.logger.log(`Enqueued invite email for ${input.email}`);
  }

  /** Enqueue resolved per-channel notification jobs (M3-10). */
  async enqueue(jobs: NotificationJob[]): Promise<void> {
    if (jobs.length === 0) return;
    await this.queue.addBulk(
      jobs.map((job) => ({
        name: `notify_${job.channel}`,
        data: job,
        opts: {
          attempts: 3,
          backoff: { type: 'exponential' as const, delay: 2000 },
          removeOnComplete: true,
        },
      })),
    );
    this.logger.log(`Enqueued ${jobs.length} notification job(s)`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
