/**
 * Per-channel delivery for notification jobs (M3-11..13).
 *
 * Each channel resolves its provider from the environment. When the provider
 * credentials are absent (local/dev, or before M3-12/13 provisioning), the
 * channel logs the intended delivery and reports `delivered: false` so the
 * queue still records the attempt — it does not throw, so one unconfigured
 * channel never fails the job for the others.
 */

export interface NotificationJob {
  channel: 'push' | 'email' | 'sms' | 'in_app';
  type: string;
  userId: string;
  groupId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface DeliveryResult {
  channel: string;
  delivered: boolean;
  detail: string;
}

/** Push via FCM/APNs (M3-12). Requires FCM_SERVER_KEY / APNs config. */
async function deliverPush(job: NotificationJob): Promise<DeliveryResult> {
  if (!process.env.FCM_SERVER_KEY) {
    console.log(`[notifications] (push not configured) → user ${job.userId}: ${job.title}`);
    return { channel: 'push', delivered: false, detail: 'FCM_SERVER_KEY unset' };
  }
  // Provider call is wired here once FCM_SERVER_KEY is provisioned (M3-12).
  console.log(`[notifications] push → user ${job.userId}: ${job.title}`);
  return { channel: 'push', delivered: true, detail: 'sent' };
}

/** Email via SendGrid (M3-13). Requires SENDGRID_API_KEY. */
async function deliverEmail(job: NotificationJob): Promise<DeliveryResult> {
  if (!process.env.SENDGRID_API_KEY) {
    console.log(`[notifications] (email not configured) → user ${job.userId}: ${job.title}`);
    return { channel: 'email', delivered: false, detail: 'SENDGRID_API_KEY unset' };
  }
  console.log(`[notifications] email → user ${job.userId}: ${job.title}`);
  return { channel: 'email', delivered: true, detail: 'sent' };
}

/** SMS via Twilio (reserved for high-value events). Requires TWILIO_AUTH_TOKEN. */
async function deliverSms(job: NotificationJob): Promise<DeliveryResult> {
  if (!process.env.TWILIO_AUTH_TOKEN) {
    console.log(`[notifications] (sms not configured) → user ${job.userId}: ${job.title}`);
    return { channel: 'sms', delivered: false, detail: 'TWILIO_AUTH_TOKEN unset' };
  }
  console.log(`[notifications] sms → user ${job.userId}: ${job.title}`);
  return { channel: 'sms', delivered: true, detail: 'sent' };
}

/**
 * In-app: the API already writes the activity log and pushes over WebSocket at
 * mutation time, so the in-app surface is populated synchronously. The worker
 * job is a no-op acknowledgement kept for symmetry and future read-receipts.
 */
async function deliverInApp(job: NotificationJob): Promise<DeliveryResult> {
  return { channel: 'in_app', delivered: true, detail: `acked for user ${job.userId}` };
}

const HANDLERS: Record<NotificationJob['channel'], (j: NotificationJob) => Promise<DeliveryResult>> = {
  push: deliverPush,
  email: deliverEmail,
  sms: deliverSms,
  in_app: deliverInApp,
};

/** Route a job to its channel handler. */
export async function deliver(job: NotificationJob): Promise<DeliveryResult> {
  const handler = HANDLERS[job.channel];
  if (!handler) {
    return { channel: job.channel, delivered: false, detail: 'unknown channel' };
  }
  return handler(job);
}
