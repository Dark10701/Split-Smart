import { Test } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../database/prisma.service';
import { defaultNotificationPrefs } from './notification-defaults';

describe('UsersService', () => {
  const claims = {
    sub: 'auth0|42',
    email: 'Maya@Example.com',
    name: 'Maya',
    email_verified: true as const,
  };

  function build(prismaMock: Partial<Record<string, unknown>>) {
    return Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: { user: prismaMock } }],
    }).compile();
  }

  it('returns the existing user without creating', async () => {
    const existing = { id: 'u1', authSubject: 'auth0|42', email: 'maya@example.com', name: 'Maya' };
    const create = jest.fn();
    const mod = await build({ findUnique: jest.fn().mockResolvedValue(existing), create });
    const svc = mod.get(UsersService);
    await expect(svc.resolveFromClaims(claims)).resolves.toEqual(existing);
    expect(create).not.toHaveBeenCalled();
  });

  it('creates a user with seeded prefs on first sign-in', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'u2' });
    const mod = await build({ findUnique: jest.fn().mockResolvedValue(null), create });
    const svc = mod.get(UsersService);
    await svc.resolveFromClaims(claims);
    const arg = create.mock.calls[0][0];
    expect(arg.data.authSubject).toBe('auth0|42');
    expect(arg.data.email).toBe('maya@example.com');
    expect(arg.data.notificationPrefs.create).toHaveLength(defaultNotificationPrefs('').length);
  });

  it('links a new subject to the existing account with the same verified email', async () => {
    const existing = { id: 'u1', authSubject: 'dev|maya', email: 'maya@example.com', name: 'Maya' };
    // First lookup (by subject) misses; second (by email) hits.
    const findUnique = jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(existing);
    const update = jest.fn().mockResolvedValue({ ...existing, authSubject: 'auth0|42' });
    const create = jest.fn();
    const mod = await build({ findUnique, update, create });
    const svc = mod.get(UsersService);
    const user = await svc.resolveFromClaims(claims);
    expect(user.authSubject).toBe('auth0|42');
    expect(update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { authSubject: 'auth0|42' },
    });
    expect(create).not.toHaveBeenCalled();
  });
});

describe('UsersService GDPR (M6-17/18)', () => {
  it('exportData assembles the full bundle for the user', async () => {
    const prisma = {
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'u1',
          email: 'maya@example.in',
          name: 'Maya',
          defaultCurrency: 'INR',
          upiId: 'maya@okhdfcbank',
          createdAt: new Date('2026-01-01'),
          notificationPrefs: [{ id: 'p1' }],
        }),
      },
      groupMember: { findMany: jest.fn().mockResolvedValue([{ id: 'm1' }, { id: 'm2' }]) },
      expense: { findMany: jest.fn().mockResolvedValue([{ id: 'e1' }]) },
      expenseSplit: { findMany: jest.fn().mockResolvedValue([{ id: 's1' }]) },
      payment: { findMany: jest.fn().mockResolvedValue([{ id: 'pay1' }]) },
      comment: { findMany: jest.fn().mockResolvedValue([{ id: 'c1' }]) },
      activityLog: { findMany: jest.fn().mockResolvedValue([{ id: 'a1' }]) },
    };
    const svc = new UsersService(prisma as unknown as PrismaService);
    const bundle = await svc.exportData('u1');
    expect(bundle.profile.upiId).toBe('maya@okhdfcbank');
    expect(bundle.memberships).toHaveLength(2);
    expect(bundle.payments).toHaveLength(1);
    // Splits are scoped to the user's own member ids.
    expect(prisma.expenseSplit.findMany).toHaveBeenCalledWith({
      where: { memberId: { in: ['m1', 'm2'] } },
    });
  });

  it('updateNotificationPrefs upserts each toggle against the composite key', async () => {
    const upsert = jest.fn().mockReturnValue('op');
    const prisma = {
      notificationPref: {
        upsert,
        findMany: jest.fn().mockResolvedValue([{ id: 'np1', enabled: false }]),
      },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    const svc = new UsersService(prisma as unknown as PrismaService);
    const result = await svc.updateNotificationPrefs('u1', {
      prefs: [{ channel: 'push', type: 'expense_added', enabled: false }],
    });
    expect(upsert).toHaveBeenCalledWith({
      where: { userId_channel_type: { userId: 'u1', channel: 'push', type: 'expense_added' } },
      create: { userId: 'u1', channel: 'push', type: 'expense_added', enabled: false },
      update: { enabled: false },
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(['op']);
    expect(result).toHaveLength(1);
  });

  it('deleteAccount anonymizes PII, drops prefs, and soft-removes memberships', async () => {
    const prefDelete = jest.fn().mockResolvedValue({ count: 3 });
    const memberUpdate = jest.fn().mockResolvedValue({ count: 2 });
    const userUpdate = jest.fn().mockResolvedValue({});
    const tx = {
      notificationPref: { deleteMany: prefDelete },
      groupMember: { updateMany: memberUpdate },
      user: { update: userUpdate },
    };
    const svc = new UsersService({
      $transaction: (fn: (t: unknown) => unknown) => fn(tx),
    } as unknown as PrismaService);

    const result = await svc.deleteAccount('u1');
    expect(result).toEqual({ anonymizedMemberships: 2 });
    expect(prefDelete).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    expect(memberUpdate.mock.calls[0][0].data.removedAt).toBeInstanceOf(Date);
    const data = userUpdate.mock.calls[0][0].data;
    expect(data.name).toBe('Deleted user');
    expect(data.email).toBe('deleted+u1@deleted.invalid');
    expect(data.authSubject).toBe('deleted:u1');
    expect(data.upiId).toBeNull();
  });
});
