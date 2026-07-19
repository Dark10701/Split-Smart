import { GroupsService } from './groups.service';
import type { PrismaService } from '../database/prisma.service';

function makeService(overrides: Record<string, unknown>) {
  const prisma = overrides as unknown as PrismaService;
  return new GroupsService(prisma);
}

describe('GroupsService', () => {
  it('create() makes the creator an admin in a transaction', async () => {
    const group = { id: 'g1', name: 'Trip', createdById: 'u1' };
    const groupCreate = jest.fn().mockResolvedValue(group);
    const memberCreate = jest.fn().mockResolvedValue({ id: 'm1' });
    const tx = { group: { create: groupCreate }, groupMember: { create: memberCreate } };
    const svc = makeService({ $transaction: (fn: (t: unknown) => unknown) => fn(tx) });

    const result = await svc.create('u1', { name: 'Trip' });
    expect(result).toEqual(group);
    expect(memberCreate).toHaveBeenCalledWith({
      data: { groupId: 'g1', userId: 'u1', role: 'admin' },
    });
    // India-first: groups created without an explicit currency default to INR.
    expect(groupCreate.mock.calls[0][0].data.defaultCurrency).toBe('INR');
  });

  it('join() rejects an invalid/used invitation', async () => {
    const svc = makeService({
      invitation: {
        findUnique: jest.fn().mockResolvedValue({ acceptedAt: new Date(), expiresAt: null }),
      },
    });
    await expect(svc.join('u2', 'tok')).rejects.toThrow(/Invalid or expired/);
  });

  it('join() rejects when already a member', async () => {
    const svc = makeService({
      invitation: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'i1', groupId: 'g1', acceptedAt: null, expiresAt: null }),
      },
      groupMember: { findFirst: jest.fn().mockResolvedValue({ id: 'existing' }) },
    });
    await expect(svc.join('u1', 'tok')).rejects.toThrow(/Already a member/);
  });

  it('addMember() creates a guest without an account lookup', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'm9' });
    const svc = makeService({ groupMember: { create } });
    await svc.addMember('g1', { guestName: 'Bob', role: 'member' });
    expect(create).toHaveBeenCalledWith({
      data: { groupId: 'g1', guestName: 'Bob', role: 'member' },
    });
  });

  it('addMember() errors when email has no account', async () => {
    const svc = makeService({ user: { findUnique: jest.fn().mockResolvedValue(null) } });
    await expect(svc.addMember('g1', { email: 'no@one.com', role: 'member' })).rejects.toThrow(
      /No account/,
    );
  });

  it('createInvite() enqueues an email when an email is given', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'i1' });
    const sendInvite = jest.fn().mockResolvedValue(undefined);
    const svc = new GroupsService({ invitation: { create } } as unknown as PrismaService, {
      sendInvite,
    });
    await svc.createInvite('g1', 'invitee@x.com');
    expect(sendInvite).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'invitee@x.com', groupId: 'g1' }),
    );
  });

  it('createInvite() does not enqueue without an email', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'i1' });
    const findFirst = jest.fn().mockResolvedValue(null);
    const sendInvite = jest.fn();
    const svc = new GroupsService(
      { invitation: { create, findFirst } } as unknown as PrismaService,
      { sendInvite },
    );
    await svc.createInvite('g1');
    expect(sendInvite).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalled();
  });

  it('createInvite() reuses the existing shareable link token', async () => {
    const create = jest.fn();
    const findFirst = jest.fn().mockResolvedValue({
      id: 'i1',
      token: 'permanent-token',
      email: null,
      acceptedAt: null,
      expiresAt: null,
    });
    const svc = new GroupsService(
      { invitation: { create, findFirst } } as unknown as PrismaService,
      { sendInvite: jest.fn() },
    );
    await expect(svc.createInvite('g1')).resolves.toEqual({ token: 'permanent-token' });
    expect(create).not.toHaveBeenCalled();
  });

  it('join() keeps shareable link invites open but consumes email invites', async () => {
    const linkInvite = {
      id: 'i1',
      groupId: 'g1',
      token: 't',
      email: null,
      acceptedAt: null,
      expiresAt: null,
    };
    const update = jest.fn();
    const member = { id: 'm1' };
    const prisma = {
      invitation: { findUnique: jest.fn().mockResolvedValue(linkInvite), update },
      groupMember: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockReturnValue(member),
      },
      $transaction: jest.fn((ops: unknown[]) => Promise.resolve(ops.map(() => member))),
    } as unknown as PrismaService;
    const svc = new GroupsService(prisma);
    await svc.join('u1', 't');
    // Link invite (no email): acceptedAt must NOT be stamped — link stays live.
    expect(update).not.toHaveBeenCalled();
  });
});
