import { describe, it, expect } from 'vitest';
import { buildBalanceSheet } from './balances';
import type { GroupDetail, GroupBalances, Expense } from './api';

function member(id: string, userId: string | null, name: string) {
  return {
    id,
    userId,
    guestName: userId ? null : name,
    role: 'member',
    user: userId ? { name, upiId: null, avatarColor: null } : null,
  };
}

const groupBase = (over: Partial<GroupDetail>): GroupDetail => ({
  id: 'g1',
  name: 'Goa Trip',
  defaultCurrency: 'INR',
  createdAt: '2026-01-01',
  members: [],
  ...over,
});

describe('buildBalanceSheet', () => {
  const group = groupBase({
    members: [member('m-maya', 'user-maya', 'Maya'), member('m-ravi', 'user-ravi', 'Ravi')],
  });
  const expenses: Expense[] = [
    {
      id: 'e1',
      payerMemberId: 'm-maya',
      amountMinor: 100000,
      currency: 'INR',
      description: 'Hotel',
      splitType: 'equal',
      occurredAt: '2026-07-14T00:00:00Z',
      version: 1,
      splits: [
        { id: 's1', memberId: 'm-maya', shareMinor: 50000 },
        { id: 's2', memberId: 'm-ravi', shareMinor: 50000 },
      ],
      items: [],
    },
    {
      id: 'e2',
      payerMemberId: 'm-ravi',
      amountMinor: 40000,
      currency: 'INR',
      description: 'Dinner',
      splitType: 'equal',
      occurredAt: '2026-07-15T00:00:00Z',
      version: 1,
      splits: [
        { id: 's3', memberId: 'm-maya', shareMinor: 20000 },
        { id: 's4', memberId: 'm-ravi', shareMinor: 20000 },
      ],
      items: [],
    },
  ];
  const balances: GroupBalances = {
    nets: {},
    settlements: [
      { fromMemberId: 'm-ravi', toMemberId: 'm-maya', amountMinor: 30000, currency: 'INR' },
    ],
  };

  it('totals expenses and reconciles contributions and shares', () => {
    const sheet = buildBalanceSheet(group, expenses, balances);
    expect(sheet.totalExpensesMinor).toBe(140000);

    const contribSum = sheet.members.reduce((s, m) => s + m.contributedMinor, 0);
    const shareSum = sheet.members.reduce((s, m) => s + m.shareMinor, 0);
    expect(contribSum).toBe(140000);
    expect(shareSum).toBe(140000);
    expect(sheet.members.reduce((s, m) => s + m.netMinor, 0)).toBe(0);

    const maya = sheet.members.find((m) => m.name === 'Maya')!;
    expect(maya.contributedMinor).toBe(100000);
    expect(maya.shareMinor).toBe(70000);
    expect(maya.netMinor).toBe(30000);
  });

  it('sorts expense history newest first and maps outstanding transfers', () => {
    const sheet = buildBalanceSheet(group, expenses, balances);
    expect(sheet.expenses.map((e) => e.description)).toEqual(['Dinner', 'Hotel']);
    expect(sheet.outstanding).toEqual([{ fromName: 'Ravi', toName: 'Maya', amountMinor: 30000 }]);
  });
});
