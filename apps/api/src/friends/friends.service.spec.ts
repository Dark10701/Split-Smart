import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { FriendsService } from './friends.service';
import type { PrismaService } from '../database/prisma.service';

const user = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  name: `User ${id}`,
  email: `${id}@x.com`,
  phone: null,
  upiId: null,
  avatarColor: null,
  ...over,
});

function build(prismaMock: Record<string, unknown>) {
  return new FriendsService(prismaMock as unknown as PrismaService);
}

describe('FriendsService.sendRequest', () => {
  it('rejects self-requests', async () => {
    const svc = build({});
    await expect(svc.sendRequest('u1', 'u1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a pending edge to a real user', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'f1', status: 'pending' });
    const svc = build({
      user: { findUnique: jest.fn().mockResolvedValue(user('u2')) },
      friendship: { findFirst: jest.fn().mockResolvedValue(null), create },
    });
    const edge = await svc.sendRequest('u1', 'u2');
    expect(edge.status).toBe('pending');
    expect(create).toHaveBeenCalledWith({ data: { requesterId: 'u1', addresseeId: 'u2' } });
  });

  it('is idempotent for my own pending request', async () => {
    const mine = { id: 'f1', requesterId: 'u1', addresseeId: 'u2', status: 'pending' };
    const create = jest.fn();
    const svc = build({
      user: { findUnique: jest.fn().mockResolvedValue(user('u2')) },
      friendship: { findFirst: jest.fn().mockResolvedValue(mine), create },
    });
    await expect(svc.sendRequest('u1', 'u2')).resolves.toEqual(mine);
    expect(create).not.toHaveBeenCalled();
  });

  it('auto-accepts when the other side already asked', async () => {
    const theirs = { id: 'f1', requesterId: 'u2', addresseeId: 'u1', status: 'pending' };
    const update = jest.fn().mockResolvedValue({ ...theirs, status: 'accepted' });
    const svc = build({
      user: { findUnique: jest.fn().mockResolvedValue(user('u2')) },
      friendship: { findFirst: jest.fn().mockResolvedValue(theirs), update },
    });
    const edge = await svc.sendRequest('u1', 'u2');
    expect(edge.status).toBe('accepted');
    expect(update).toHaveBeenCalledWith({ where: { id: 'f1' }, data: { status: 'accepted' } });
  });

  it('409s when already friends and 403s across a block', async () => {
    const accepted = { id: 'f1', requesterId: 'u2', addresseeId: 'u1', status: 'accepted' };
    const svcA = build({
      user: { findUnique: jest.fn().mockResolvedValue(user('u2')) },
      friendship: { findFirst: jest.fn().mockResolvedValue(accepted) },
    });
    await expect(svcA.sendRequest('u1', 'u2')).rejects.toBeInstanceOf(ConflictException);

    const blocked = { id: 'f2', requesterId: 'u2', addresseeId: 'u1', status: 'blocked' };
    const svcB = build({
      user: { findUnique: jest.fn().mockResolvedValue(user('u2')) },
      friendship: { findFirst: jest.fn().mockResolvedValue(blocked) },
    });
    await expect(svcB.sendRequest('u1', 'u2')).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('FriendsService.respond', () => {
  it('only the addressee of a pending request can respond', async () => {
    const edge = { id: 'f1', requesterId: 'u1', addresseeId: 'u2', status: 'pending' };
    const svc = build({
      friendship: { findUnique: jest.fn().mockResolvedValue(edge) },
    });
    // u1 is the requester, not the addressee → not found (no leaking).
    await expect(svc.respond('u1', 'f1', true)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('accept updates, reject deletes', async () => {
    const edge = { id: 'f1', requesterId: 'u1', addresseeId: 'u2', status: 'pending' };
    const update = jest.fn().mockResolvedValue({});
    const del = jest.fn().mockResolvedValue({});
    const svc = build({
      friendship: { findUnique: jest.fn().mockResolvedValue(edge), update, delete: del },
    });
    await svc.respond('u2', 'f1', true);
    expect(update).toHaveBeenCalledWith({ where: { id: 'f1' }, data: { status: 'accepted' } });
    await svc.respond('u2', 'f1', false);
    expect(del).toHaveBeenCalledWith({ where: { id: 'f1' } });
  });
});

describe('FriendsService.search', () => {
  it('matches phone exactly after normalization and annotates relationship', async () => {
    const findMany = jest.fn().mockResolvedValue([user('u2', { phone: '+919876543210' })]);
    const svc = build({
      user: { findMany },
      friendship: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'f1', requesterId: 'u1', addresseeId: 'u2', status: 'pending' },
          ]),
      },
    });
    const hits = await svc.search('u1', '98765 43210');
    expect(findMany.mock.calls[0][0].where.OR).toEqual([{ phone: '+919876543210' }]);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.relationship).toBe('request_sent');
  });

  it('hides users who blocked the caller', async () => {
    const svc = build({
      user: { findMany: jest.fn().mockResolvedValue([user('u2')]) },
      friendship: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'f1', requesterId: 'u2', addresseeId: 'u1', status: 'blocked' },
          ]),
      },
    });
    await expect(svc.search('u1', 'User u2')).resolves.toHaveLength(0);
  });
});

describe('FriendsService.overview', () => {
  it('splits edges into friends, incoming, outgoing, and my blocks', async () => {
    const me = 'u1';
    const edges = [
      {
        id: 'f1',
        requesterId: 'u1',
        addresseeId: 'u2',
        status: 'accepted',
        requester: user('u1'),
        addressee: user('u2'),
      },
      {
        id: 'f2',
        requesterId: 'u3',
        addresseeId: 'u1',
        status: 'pending',
        requester: user('u3'),
        addressee: user('u1'),
      },
      {
        id: 'f3',
        requesterId: 'u1',
        addresseeId: 'u4',
        status: 'pending',
        requester: user('u1'),
        addressee: user('u4'),
      },
      {
        id: 'f4',
        requesterId: 'u5',
        addresseeId: 'u1',
        status: 'blocked', // they blocked me — must NOT appear anywhere
        requester: user('u5'),
        addressee: user('u1'),
      },
    ];
    const svc = build({ friendship: { findMany: jest.fn().mockResolvedValue(edges) } });
    const o = await svc.overview(me);
    expect(o.friends.map((f) => f.id)).toEqual(['u2']);
    expect(o.incoming.map((r) => r.user.id)).toEqual(['u3']);
    expect(o.outgoing.map((r) => r.user.id)).toEqual(['u4']);
    expect(o.blocked).toHaveLength(0);
  });
});

describe('FriendsService.remove/block', () => {
  it('remove deletes accepted or my pending, not their pending', async () => {
    const theirs = { id: 'f1', requesterId: 'u2', addresseeId: 'u1', status: 'pending' };
    const svc = build({
      friendship: { findFirst: jest.fn().mockResolvedValue(theirs), delete: jest.fn() },
    });
    await expect(svc.remove('u1', 'u2')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('block replaces any edge with a blocked edge owned by me', async () => {
    const existing = { id: 'f1', requesterId: 'u2', addresseeId: 'u1', status: 'accepted' };
    const del = jest.fn().mockResolvedValue({});
    const create = jest.fn().mockResolvedValue({});
    const svc = build({
      user: { findUnique: jest.fn().mockResolvedValue(user('u2')) },
      friendship: { findFirst: jest.fn().mockResolvedValue(existing), delete: del, create },
    });
    await svc.block('u1', 'u2');
    expect(del).toHaveBeenCalledWith({ where: { id: 'f1' } });
    expect(create).toHaveBeenCalledWith({
      data: { requesterId: 'u1', addresseeId: 'u2', status: 'blocked' },
    });
  });
});
