import { NotificationsService } from './notifications.service';
import type { PrismaService } from '../database/prisma.service';
import type { NotificationDispatcher } from '../queue/notification-dispatch';

function makeService(prefs: Array<{ userId: string; channel: string; type: string }>) {
  const findMany = jest.fn().mockResolvedValue(prefs);
  const enqueue = jest.fn().mockResolvedValue(undefined);
  const svc = new NotificationsService(
    { notificationPref: { findMany } } as unknown as PrismaService,
    { enqueue } as unknown as NotificationDispatcher,
  );
  return { svc, findMany, enqueue };
}

describe('NotificationsService.notify', () => {
  it('excludes the actor and enqueues one job per enabled channel', async () => {
    const { svc, findMany, enqueue } = makeService([
      { userId: 'u2', channel: 'push', type: 'expense_added' },
      { userId: 'u2', channel: 'email', type: 'expense_added' },
    ]);
    await svc.notify({
      groupId: 'g1',
      type: 'expense_added',
      actorUserId: 'u1',
      recipientUserIds: ['u1', 'u2'],
      title: 'New expense',
      body: 'Dinner',
    });
    // Actor u1 filtered out of the pref query.
    expect(findMany.mock.calls[0][0].where.userId.in).toEqual(['u2']);
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue.mock.calls[0][0]).toHaveLength(2);
  });

  it('does nothing when the only recipient is the actor', async () => {
    const { svc, findMany, enqueue } = makeService([]);
    await svc.notify({
      groupId: 'g1',
      type: 'settle_up',
      actorUserId: 'u1',
      recipientUserIds: ['u1'],
      title: 't',
      body: 'b',
    });
    expect(findMany).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('swallows a dispatch failure without throwing (never blocks the mutation)', async () => {
    const findMany = jest.fn().mockRejectedValue(new Error('db down'));
    const enqueue = jest.fn();
    const svc = new NotificationsService(
      { notificationPref: { findMany } } as unknown as PrismaService,
      { enqueue } as unknown as NotificationDispatcher,
    );
    await expect(
      svc.notify({
        groupId: 'g1',
        type: 'expense_added',
        actorUserId: 'u1',
        recipientUserIds: ['u2'],
        title: 't',
        body: 'b',
      }),
    ).resolves.toBeUndefined();
  });
});
