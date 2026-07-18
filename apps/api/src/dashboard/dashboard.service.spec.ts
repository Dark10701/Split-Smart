import { DashboardService } from './dashboard.service';
import type { PrismaService } from '../database/prisma.service';
import type { BalancesService } from '../balances/balances.service';

function build(
  memberships: unknown[],
  balancesByGroup: Record<
    string,
    { nets: Record<string, Record<string, number>>; settlements: unknown[] }
  >,
) {
  const prisma = {
    groupMember: { findMany: jest.fn().mockResolvedValue(memberships) },
  } as unknown as PrismaService;
  const balances = {
    getForGroup: jest.fn((groupId: string) => Promise.resolve(balancesByGroup[groupId])),
  } as unknown as BalancesService;
  return new DashboardService(prisma, balances);
}

describe('DashboardService.forUser', () => {
  it('annotates each group with the user net and sums the overall', async () => {
    const svc = build(
      [
        { id: 'm1', groupId: 'g1', group: { id: 'g1', name: 'Goa', defaultCurrency: 'INR' } },
        { id: 'm2', groupId: 'g2', group: { id: 'g2', name: 'Flat', defaultCurrency: 'INR' } },
      ],
      {
        g1: { nets: { INR: { m1: 30000, other: -30000 } }, settlements: [] },
        g2: { nets: { INR: { m2: -10000 } }, settlements: [] },
      },
    );
    const dash = await svc.forUser('u1');
    expect(dash.groups).toEqual([
      { id: 'g1', name: 'Goa', defaultCurrency: 'INR', myNetMinor: 30000 },
      { id: 'g2', name: 'Flat', defaultCurrency: 'INR', myNetMinor: -10000 },
    ]);
    expect(dash.overallNetMinor).toBe(20000);
    expect(dash.currency).toBe('INR');
  });

  it('defaults net to 0 when the member is absent from the nets map', async () => {
    const svc = build(
      [{ id: 'm1', groupId: 'g1', group: { id: 'g1', name: 'X', defaultCurrency: 'INR' } }],
      {
        g1: { nets: { INR: {} }, settlements: [] },
      },
    );
    const dash = await svc.forUser('u1');
    expect(dash.groups[0]!.myNetMinor).toBe(0);
    expect(dash.overallNetMinor).toBe(0);
  });
});

describe('DashboardService.friendBalancesForUser', () => {
  const memberships = [
    {
      id: 'm-me',
      groupId: 'g1',
      group: {
        id: 'g1',
        name: 'Goa',
        defaultCurrency: 'INR',
        members: [
          { id: 'm-me', userId: 'u1', guestName: null, user: { name: 'Me', avatarColor: null } },
          {
            id: 'm-maya',
            userId: 'u2',
            guestName: null,
            user: { name: 'Maya', avatarColor: '#db2777' },
          },
          { id: 'm-guest', userId: null, guestName: 'Guest', user: null },
        ],
      },
    },
  ];

  it('aggregates settlements that involve me, keyed by userId / guest member', async () => {
    const svc = build(memberships, {
      g1: {
        nets: {},
        settlements: [
          { fromMemberId: 'm-me', toMemberId: 'm-maya', amountMinor: 25000, currency: 'INR' }, // I owe Maya
          { fromMemberId: 'm-guest', toMemberId: 'm-me', amountMinor: 5000, currency: 'INR' }, // guest owes me
          { fromMemberId: 'm-maya', toMemberId: 'm-guest', amountMinor: 9999, currency: 'INR' }, // not me → ignored
        ],
      },
    });
    const fb = await svc.friendBalancesForUser('u1');
    const maya = fb.find((f) => f.key === 'user:u2')!;
    expect(maya.iOweMinor).toBe(25000);
    expect(maya.netMinor).toBe(-25000);
    expect(maya.name).toBe('Maya');
    expect(maya.groups).toEqual([{ id: 'g1', name: 'Goa' }]);
    const guest = fb.find((f) => f.key === 'guest:m-guest')!;
    expect(guest.owesMeMinor).toBe(5000);
    expect(guest.netMinor).toBe(5000);
    expect(fb).toHaveLength(2); // the m-maya→m-guest settlement is not attributed to me
  });
});
