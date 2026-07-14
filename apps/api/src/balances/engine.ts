/**
 * Pure balance engine (M2-14) + debt minimization (M2-15).
 *
 * Side-effect-free and deterministic: given the expenses (and, from M3 on,
 * payments) of a group, computes each member's net position per currency and
 * the minimum set of transfers that settles the group.
 *
 * Sign convention: positive net = the member is owed money (creditor),
 * negative net = the member owes money (debtor). Nets always sum to zero
 * per currency; the engine re-verifies this invariant and throws if a
 * caller feeds it an unreconciled ledger.
 */

export interface LedgerSplit {
  memberId: string;
  shareMinor: number;
}

export interface LedgerExpense {
  payerMemberId: string;
  amountMinor: number;
  currency: string;
  splits: LedgerSplit[];
}

/** A settlement: `from` pays `to`. */
export interface LedgerPayment {
  fromMemberId: string;
  toMemberId: string;
  amountMinor: number;
  currency: string;
}

/** memberId -> net minor units (per currency). */
export type NetBalances = Record<string, Record<string, number>>;

export interface Transfer {
  fromMemberId: string;
  toMemberId: string;
  amountMinor: number;
  currency: string;
}

export class BalanceError extends Error {}

function add(nets: NetBalances, currency: string, memberId: string, delta: number): void {
  const byMember = (nets[currency] ??= {});
  byMember[memberId] = (byMember[memberId] ?? 0) + delta;
}

/** Compute per-member net balances, grouped by currency. */
export function computeNetBalances(
  expenses: readonly LedgerExpense[],
  payments: readonly LedgerPayment[] = [],
): NetBalances {
  const nets: NetBalances = {};

  for (const e of expenses) {
    const splitSum = e.splits.reduce((s, x) => s + x.shareMinor, 0);
    if (splitSum !== e.amountMinor) {
      throw new BalanceError(
        `Expense splits (${splitSum}) do not reconcile to total (${e.amountMinor})`,
      );
    }
    add(nets, e.currency, e.payerMemberId, e.amountMinor);
    for (const s of e.splits) add(nets, e.currency, s.memberId, -s.shareMinor);
  }

  for (const p of payments) {
    if (!Number.isInteger(p.amountMinor) || p.amountMinor <= 0) {
      throw new BalanceError('Payment amount must be a positive integer');
    }
    // Paying down a debt raises the payer's net and lowers the receiver's.
    add(nets, p.currency, p.fromMemberId, p.amountMinor);
    add(nets, p.currency, p.toMemberId, -p.amountMinor);
  }

  for (const [currency, byMember] of Object.entries(nets)) {
    const sum = Object.values(byMember).reduce((s, v) => s + v, 0);
    if (sum !== 0) {
      throw new BalanceError(`Nets for ${currency} sum to ${sum}, expected 0`);
    }
  }
  return nets;
}

/**
 * Minimize the transfers needed to settle one currency's nets.
 *
 * Greedy largest-debtor -> largest-creditor matching: at most (n - 1)
 * transfers for n members with non-zero nets, which is optimal for the
 * overwhelmingly common case and never worse than pairwise settling.
 * Deterministic: ties broken by memberId.
 */
export function minimizeDebts(netByMember: Record<string, number>, currency: string): Transfer[] {
  const sum = Object.values(netByMember).reduce((s, v) => s + v, 0);
  if (sum !== 0) throw new BalanceError(`Nets sum to ${sum}, expected 0`);

  const debtors = Object.entries(netByMember)
    .filter(([, net]) => net < 0)
    .map(([memberId, net]) => ({ memberId, remaining: -net }));
  const creditors = Object.entries(netByMember)
    .filter(([, net]) => net > 0)
    .map(([memberId, net]) => ({ memberId, remaining: net }));

  const byMagnitudeDesc = (
    a: { remaining: number; memberId: string },
    b: { remaining: number; memberId: string },
  ): number => b.remaining - a.remaining || a.memberId.localeCompare(b.memberId);

  const transfers: Transfer[] = [];
  for (;;) {
    debtors.sort(byMagnitudeDesc);
    creditors.sort(byMagnitudeDesc);
    const d = debtors[0];
    const c = creditors[0];
    if (!d || !c) break;
    const amount = Math.min(d.remaining, c.remaining);
    transfers.push({
      fromMemberId: d.memberId,
      toMemberId: c.memberId,
      amountMinor: amount,
      currency,
    });
    d.remaining -= amount;
    c.remaining -= amount;
    if (d.remaining === 0) debtors.shift();
    if (c.remaining === 0) creditors.shift();
  }
  return transfers;
}

/** Full settlement plan across every currency in the nets. */
export function settlementPlan(nets: NetBalances): Transfer[] {
  return Object.keys(nets)
    .sort()
    .flatMap((currency) => minimizeDebts(nets[currency] ?? {}, currency));
}
