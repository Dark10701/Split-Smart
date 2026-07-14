/** A single per-channel notification job enqueued for the notifications worker. */
export interface NotificationJob {
  channel: 'push' | 'email' | 'sms' | 'in_app';
  type: 'expense_added' | 'settle_up' | 'payment_confirmed' | 'reminder';
  userId: string;
  groupId: string;
  /** Human-readable summary the worker renders into the channel template. */
  title: string;
  body: string;
  /** Arbitrary structured context (entity ids, amounts). */
  data?: Record<string, unknown>;
}

/** Abstraction for enqueuing resolved notification jobs. */
export interface NotificationDispatcher {
  enqueue(jobs: NotificationJob[]): Promise<void>;
}

/** DI token for the NotificationDispatcher. */
export const NOTIFICATION_DISPATCHER = Symbol('NOTIFICATION_DISPATCHER');
