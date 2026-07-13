import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  NOTIFICATION_DISPATCHER,
  type NotificationDispatcher,
  type NotificationJob,
} from '../queue/notification-dispatch';

type NotificationType = NotificationJob['type'];

export interface NotifyInput {
  groupId: string;
  type: NotificationType;
  /** Users to notify. The actor is excluded automatically. */
  recipientUserIds: string[];
  actorUserId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * Preference-aware notification dispatch (M3-10).
 *
 * Resolves each recipient's per-channel `notification_prefs` for the event type
 * and enqueues one job per enabled channel. The actor never notifies themselves.
 * Enqueuing is best-effort: a queue failure is logged but never blocks the
 * financial mutation that triggered it.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(NOTIFICATION_DISPATCHER)
    private readonly dispatcher?: NotificationDispatcher,
  ) {}

  async notify(input: NotifyInput): Promise<void> {
    const recipients = [...new Set(input.recipientUserIds)].filter(
      (id) => id !== input.actorUserId,
    );
    if (recipients.length === 0 || !this.dispatcher) return;

    try {
      const prefs = await this.prisma.notificationPref.findMany({
        where: { userId: { in: recipients }, type: input.type, enabled: true },
      });
      const jobs: NotificationJob[] = prefs.map((p) => ({
        channel: p.channel,
        type: input.type,
        userId: p.userId,
        groupId: input.groupId,
        title: input.title,
        body: input.body,
        ...(input.data ? { data: input.data } : {}),
      }));
      await this.dispatcher.enqueue(jobs);
    } catch (err) {
      this.logger.warn(`Notification dispatch failed: ${(err as Error).message}`);
    }
  }
}
