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
  });

  it('join() rejects an invalid/used invitation', async () => {
    const svc = makeService({
      invitation: { findUnique: jest.fn().mockResolvedValue({ acceptedAt: new Date(), expiresAt: null }) },
    });
    await expect(svc.join('u2', 'tok')).rejects.toThrow(/Invalid or expired/);
  });

  it('join() rejects when already a member', async () => {
    const svc = makeService({
      invitation: { findUnique: jest.fn().mockResolvedValue({ id: 'i1', groupId: 'g1', acceptedAt: null, expiresAt: null }) },
      groupMember: { findFirst: jest.fn().mockResolvedValue({ id: 'existing' }) },
    });
    await expect(svc.join('u1', 'tok')).rejects.toThrow(/Already a member/);
  });

  it('addMember() creates a guest without an account lookup', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'm9' });
    const svc = makeService({ groupMember: { create } });
    await svc.addMember('g1', { guestName: 'Bob', role: 'member' });
    expect(create).toHaveBeenCalledWith({ data: { groupId: 'g1', guestName: 'Bob', role: 'member' } });
  });

  it('addMember() errors when email has no account', async () => {
    const svc = makeService({ user: { findUnique: jest.fn().mockResolvedValue(null) } });
    await expect(svc.addMember('g1', { email: 'no@one.com', role: 'member' })).rejects.toThrow(/No account/);
  });
});
