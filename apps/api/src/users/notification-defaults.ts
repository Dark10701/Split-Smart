import type { NotificationChannel, NotificationType } from '@prisma/client';

const CHANNELS: NotificationChannel[] = ['push', 'email', 'sms', 'in_app'];
const TYPES: NotificationType[] = ['expense_added', 'settle_up', 'payment_confirmed', 'reminder'];

/**
 * Default notification preferences for a new user: everything on, except SMS,
 * which is opt-in. Returns rows ready for `createMany`.
 */
export function defaultNotificationPrefs(
  userId: string,
): Array<{ userId: string; channel: NotificationChannel; type: NotificationType; enabled: boolean }> {
  const rows = [];
  for (const channel of CHANNELS) {
    for (const type of TYPES) {
      rows.push({ userId, channel, type, enabled: channel !== 'sms' });
    }
  }
  return rows;
}
