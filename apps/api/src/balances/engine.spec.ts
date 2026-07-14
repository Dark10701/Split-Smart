import {
  computeNetBalances,
  minimizeDebts,
  settlementPlan,
  BalanceError,
  type LedgerExpense,
} from './engine';

const A = 'member-a';
const B = 'member-b';
const C = 'member-c';
const D = 'member-d';

function expense(
  payer: string,
  amount: number,
  splits: Array<[string, number]>,
  currency = 'USD',
): LedgerExpense {
  return {
    payerMemberId: payer,
    amountMinor: amount,
    currency,
    splits: splits.map(([memberId, shareMinor]) => ({ memberId, shareMinor })),
  };
}

/** Apply a settlement plan to a net map and report whether everyone ends at zero. */
function applyAndCheckZero(
  nets: Record<string, number>,
  transfers: Array<{ fromMemberId: string; toMemberId: string; amountMinor: number }>,
): boolean {
  const applied: Record<string, number> = { ...nets };
  for (const t of transfers) {
    applied[t.fromMemberId] = (applied[t.fromMemberId] ?? 0) + t.amountMinor;
    applied[t.toMemberId] = (applied[t.toMemberId] ?? 0) - t.amountMinor;
  }
  return Object.values(applied).every((v) => v === 0);
}

describe('computeNetBalances', () => {
  it('nets a single equal-split expense', () => {
    const nets = computeNetBalances([
      expense(A, 3000, [
        [A, 1000],
        [B, 1000],
        [C, 1000],
      ]),
    ]);
    expect(nets.USD).toEqual({ [A]: 2000, [B]: -1000, [C]: -1000 });
  });

  it('accumulates across multiple expenses', () => {
    const nets = computeNetBalances([
      expense(A, 1000, [
        [A, 500],
        [B, 500],
      ]),
      expense(B, 1000, [
        [A, 500],
        [B, 500],
      ]),
    ]);
    expect(nets.USD).toEqual({ [A]: 0, [B]: 0 });
  });

  it('keeps currencies separate', () => {
    const nets = computeNetBalances([
      expense(A, 100, [[B, 100]], 'USD'),
      expense(B, 200, [[A, 200]], 'EUR'),
    ]);
    expect(nets.USD).toEqual({ [A]: 100, [B]: -100 });
    expect(nets.EUR).toEqual({ [B]: 200, [A]: -200 });
  });

  it('applies payments against debts', () => {
    const nets = computeNetBalances(
      [expense(A, 1000, [[B, 1000]])],
      [{ fromMemberId: B, toMemberId: A, amountMinor: 600, currency: 'USD' }],
    );
    expect(nets.USD).toEqual({ [A]: 400, [B]: -400 });
  });

  it('rejects an expense whose splits do not reconcile', () => {
    expect(() =>
      computeNetBalances([expense(A, 1000, [[B, 999]])]),
    ).toThrow(BalanceError);
  });

  it('rejects non-positive payments', () => {
    expect(() =>
      computeNetBalances([], [{ fromMemberId: A, toMemberId: B, amountMinor: 0, currency: 'USD' }]),
    ).toThrow(BalanceError);
  });

  it('is deterministic: same ledger, same result object', () => {
    const ledger = [
      expense(A, 301, [
        [A, 100],
        [B, 100],
        [C, 101],
      ]),
      expense(C, 55, [
        [A, 28],
        [B, 27],
      ]),
    ];
    expect(computeNetBalances(ledger)).toEqual(computeNetBalances(ledger));
  });
});

describe('minimizeDebts', () => {
  it('settles a simple two-person debt with one transfer', () => {
    const t = minimizeDebts({ [A]: 500, [B]: -500 }, 'USD');
    expect(t).toEqual([
      { fromMemberId: B, toMemberId: A, amountMinor: 500, currency: 'USD' },
    ]);
  });

  it('uses at most n-1 transfers', () => {
    const t = minimizeDebts({ [A]: 300, [B]: -100, [C]: -100, [D]: -100 }, 'USD');
    expect(t.length).toBeLessThanOrEqual(3);
    expect(t.every((x) => x.toMemberId === A)).toBe(true);
  });

  it('collapses chains (A owes B, B owes C -> A pays C)', () => {
    // A paid nothing, owes 100; B is even overall; C is owed 100.
    const t = minimizeDebts({ [A]: -100, [B]: 0, [C]: 100 }, 'USD');
    expect(t).toEqual([
      { fromMemberId: A, toMemberId: C, amountMinor: 100, currency: 'USD' },
    ]);
  });

  it('handles a complex group correctly (conservation check)', () => {
    const nets = { [A]: 750, [B]: -320, [C]: -180, [D]: -250 };
    const t = minimizeDebts(nets, 'USD');
    for (const x of t) expect(x.amountMinor).toBeGreaterThan(0);
    expect(applyAndCheckZero(nets, t)).toBe(true);
  });

  it('returns no transfers when everyone is settled', () => {
    expect(minimizeDebts({ [A]: 0, [B]: 0 }, 'USD')).toEqual([]);
  });

  it('rejects nets that do not sum to zero', () => {
    expect(() => minimizeDebts({ [A]: 1 }, 'USD')).toThrow(BalanceError);
  });

  it('is deterministic under ties', () => {
    const nets = { [A]: 200, [B]: -100, [C]: -100 };
    expect(minimizeDebts(nets, 'USD')).toEqual(minimizeDebts({ ...nets }, 'USD'));
  });
});

describe('settlementPlan', () => {
  it('produces per-currency transfers end to end', () => {
    const nets = computeNetBalances([
      expense(A, 3000, [
        [A, 1000],
        [B, 1000],
        [C, 1000],
      ]),
      expense(B, 90, [[C, 90]], 'EUR'),
    ]);
    const plan = settlementPlan(nets);
    expect(plan).toEqual([
      { fromMemberId: C, toMemberId: B, amountMinor: 90, currency: 'EUR' },
      { fromMemberId: B, toMemberId: A, amountMinor: 1000, currency: 'USD' },
      { fromMemberId: C, toMemberId: A, amountMinor: 1000, currency: 'USD' },
    ]);
  });

  it('property: applying the plan always zeroes every member for many ledgers', () => {
    for (let seed = 1; seed <= 25; seed++) {
      // Simple deterministic pseudo-random ledger.
      const members = [A, B, C, D];
      const expenses: LedgerExpense[] = [];
      let x = seed;
      const rnd = (): number => (x = (x * 48271) % 2147483647);
      for (let i = 0; i < 6; i++) {
        const amount = (rnd() % 5000) + 4; // >= 4 so every member can get a share
        const payer = members[rnd() % 4] as string;
        const base = Math.floor(amount / 4);
        const shares: Array<[string, number]> = members.map((m, idx) => [
          m,
          idx === 0 ? amount - base * 3 : base,
        ]);
        expenses.push(expense(payer, amount, shares));
      }
      const nets = computeNetBalances(expenses);
      expect(applyAndCheckZero(nets.USD ?? {}, settlementPlan(nets))).toBe(true);
    }
  });
});
