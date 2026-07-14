import type { SplitInput } from '@splitsmart/validation';

/**
 * Pure split-strategy engine (M2-05..09).
 *
 * Given an expense total (integer minor units) and a split specification,
 * computes each participant's share such that:
 *   - shares are non-negative integers,
 *   - shares sum EXACTLY to the total (no lost or invented cents),
 *   - the result is deterministic for a given input (remainders are
 *     distributed by largest fractional part, tie-broken by memberId).
 *
 * No I/O — exhaustively unit-testable. Callers map SplitError to HTTP 400.
 */

export class SplitError extends Error {}

export interface ComputedShare {
  memberId: string;
  shareMinor: number;
}

/** Cap on total share units to keep integer math well inside Number.MAX_SAFE_INTEGER. */
const MAX_TOTAL_UNITS = 1_000_000;

function assertUniqueMembers(ids: string[]): void {
  if (new Set(ids).size !== ids.length) {
    throw new SplitError('Duplicate member in split');
  }
}

/**
 * Distribute `total` proportionally to integer `weights` using the
 * largest-remainder method. Guarantees the outputs sum exactly to `total`.
 */
function largestRemainder(
  total: number,
  entries: Array<{ memberId: string; weight: number }>,
  weightSum: number,
): ComputedShare[] {
  const computed = entries.map((e) => {
    const exact = total * e.weight; // integer; remainder relative to weightSum
    const base = Math.floor(exact / weightSum);
    return { memberId: e.memberId, base, remainder: exact % weightSum };
  });
  let leftover = total - computed.reduce((s, c) => s + c.base, 0);
  // Largest remainder first; tie-break by memberId for determinism.
  const order = [...computed].sort(
    (a, b) => b.remainder - a.remainder || a.memberId.localeCompare(b.memberId),
  );
  const extra = new Map<string, number>();
  for (const c of order) {
    if (leftover <= 0) break;
    extra.set(c.memberId, 1);
    leftover -= 1;
  }
  return computed.map((c) => ({
    memberId: c.memberId,
    shareMinor: c.base + (extra.get(c.memberId) ?? 0),
  }));
}

/** Compute per-member shares for an expense. Throws SplitError when the input cannot reconcile. */
export function computeShares(amountMinor: number, split: SplitInput): ComputedShare[] {
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    throw new SplitError('Amount must be a positive integer of minor units');
  }

  switch (split.type) {
    case 'equal': {
      assertUniqueMembers(split.participantMemberIds);
      const entries = split.participantMemberIds.map((memberId) => ({ memberId, weight: 1 }));
      return largestRemainder(amountMinor, entries, entries.length);
    }

    case 'exact': {
      assertUniqueMembers(split.shares.map((s) => s.memberId));
      const sum = split.shares.reduce((acc, s) => acc + s.amountMinor, 0);
      if (sum !== amountMinor) {
        throw new SplitError(
          `Exact shares must sum to the total: got ${sum}, expected ${amountMinor}`,
        );
      }
      return split.shares.map((s) => ({ memberId: s.memberId, shareMinor: s.amountMinor }));
    }

    case 'percentage': {
      assertUniqueMembers(split.shares.map((s) => s.memberId));
      const bpsSum = split.shares.reduce((acc, s) => acc + s.percentBps, 0);
      if (bpsSum !== 10_000) {
        throw new SplitError(`Percentages must sum to 100% (10000 bps): got ${bpsSum}`);
      }
      const entries = split.shares.map((s) => ({ memberId: s.memberId, weight: s.percentBps }));
      return largestRemainder(amountMinor, entries, 10_000);
    }

    case 'shares': {
      assertUniqueMembers(split.shares.map((s) => s.memberId));
      const unitSum = split.shares.reduce((acc, s) => acc + s.units, 0);
      if (unitSum > MAX_TOTAL_UNITS) {
        throw new SplitError(`Total share units must not exceed ${MAX_TOTAL_UNITS}`);
      }
      const entries = split.shares.map((s) => ({ memberId: s.memberId, weight: s.units }));
      return largestRemainder(amountMinor, entries, unitSum);
    }

    case 'itemized': {
      const itemSum = split.items.reduce((acc, i) => acc + i.amountMinor, 0);
      if (itemSum !== amountMinor) {
        throw new SplitError(
          `Item amounts must sum to the total: got ${itemSum}, expected ${amountMinor}`,
        );
      }
      // Each item splits equally among its participants; a member may appear
      // in any number of items — their shares aggregate.
      const totals = new Map<string, number>();
      for (const item of split.items) {
        assertUniqueMembers(item.participantMemberIds);
        const entries = item.participantMemberIds.map((memberId) => ({ memberId, weight: 1 }));
        for (const share of largestRemainder(item.amountMinor, entries, entries.length)) {
          totals.set(share.memberId, (totals.get(share.memberId) ?? 0) + share.shareMinor);
        }
      }
      return [...totals.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([memberId, shareMinor]) => ({ memberId, shareMinor }));
    }
  }
}
