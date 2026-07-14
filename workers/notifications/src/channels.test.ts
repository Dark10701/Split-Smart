import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { deliver, type NotificationJob } from './channels';

function job(channel: NotificationJob['channel']): NotificationJob {
  return { channel, type: 'expense_added', userId: 'u1', groupId: 'g1', title: 'New expense', body: 'Dinner' };
}

describe('notification channel routing', () => {
  const original = { ...process.env };
  beforeEach(() => {
    delete process.env.FCM_SERVER_KEY;
    delete process.env.SENDGRID_API_KEY;
    delete process.env.TWILIO_AUTH_TOKEN;
  });
  afterEach(() => {
    process.env = { ...original };
  });

  it('reports not-delivered (but does not throw) when a provider is unconfigured', async () => {
    const push = await deliver(job('push'));
    expect(push).toEqual({ channel: 'push', delivered: false, detail: 'FCM_SERVER_KEY unset' });
    const email = await deliver(job('email'));
    expect(email.delivered).toBe(false);
  });

  it('marks push delivered when the provider key is present', async () => {
    process.env.FCM_SERVER_KEY = 'test-key';
    const result = await deliver(job('push'));
    expect(result.delivered).toBe(true);
  });

  it('acks in-app synchronously', async () => {
    const result = await deliver(job('in_app'));
    expect(result.delivered).toBe(true);
    expect(result.channel).toBe('in_app');
  });

  it('handles an unknown channel gracefully', async () => {
    const result = await deliver({ ...job('push'), channel: 'carrier-pigeon' as NotificationJob['channel'] });
    expect(result.delivered).toBe(false);
  });
});
