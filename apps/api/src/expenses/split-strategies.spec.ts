import { computeShares, SplitError } from './split-strategies';

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const C = '00000000-0000-4000-8000-00000000000c';

function total(shares: Array<{ shareMinor: number }>): number {
  return shares.reduce((s, x) => s + x.shareMinor, 0);
}

describe('computeShares', () => {
  describe('equal', () => {
    it('splits evenly when divisible', () => {
      const r = computeShares(3000, { type: 'equal', participantMemberIds: [A, B, C] });
      expect(r.map((s) => s.shareMinor)).toEqual([1000, 1000, 1000]);
    });

    it('distributes remainder cents deterministically and loses nothing', () => {
      const r = computeShares(100, { type: 'equal', participantMemberIds: [C, A, B] });
      expect(total(r)).toBe(100);
      expect(r.map((s) => s.shareMinor).sort()).toEqual([33, 33, 34]);
      // Deterministic regardless of input order: tie-break on memberId means A gets the extra cent.
      expect(r.find((s) => s.memberId === A)?.shareMinor).toBe(34);
      const r2 = computeShares(100, { type: 'equal', participantMemberIds: [B, C, A] });
      expect(r2.find((s) => s.memberId === A)?.shareMinor).toBe(34);
    });

    it('handles amounts smaller than the participant count', () => {
      const r = computeShares(2, { type: 'equal', participantMemberIds: [A, B, C] });
      expect(total(r)).toBe(2);
      expect(r.map((s) => s.shareMinor).sort()).toEqual([0, 1, 1]);
    });

    it('single participant gets everything', () => {
      expect(computeShares(999, { type: 'equal', participantMemberIds: [B] })).toEqual([
        { memberId: B, shareMinor: 999 },
      ]);
    });

    it('rejects duplicate participants', () => {
      expect(() => computeShares(100, { type: 'equal', participantMemberIds: [A, A] })).toThrow(
        SplitError,
      );
    });
  });

  describe('exact', () => {
    it('passes through amounts that reconcile', () => {
      const r = computeShares(500, {
        type: 'exact',
        shares: [
          { memberId: A, amountMinor: 300 },
          { memberId: B, amountMinor: 200 },
        ],
      });
      expect(total(r)).toBe(500);
    });

    it('rejects when shares do not sum to the total', () => {
      expect(() =>
        computeShares(500, {
          type: 'exact',
          shares: [
            { memberId: A, amountMinor: 300 },
            { memberId: B, amountMinor: 100 },
          ],
        }),
      ).toThrow(/must sum to the total/);
    });

    it('allows a zero share (member explicitly excluded from cost)', () => {
      const r = computeShares(500, {
        type: 'exact',
        shares: [
          { memberId: A, amountMinor: 500 },
          { memberId: B, amountMinor: 0 },
        ],
      });
      expect(total(r)).toBe(500);
    });
  });

  describe('percentage', () => {
    it('splits by basis points exactly', () => {
      const r = computeShares(10000, {
        type: 'percentage',
        shares: [
          { memberId: A, percentBps: 2500 },
          { memberId: B, percentBps: 7500 },
        ],
      });
      expect(r).toEqual([
        { memberId: A, shareMinor: 2500 },
        { memberId: B, shareMinor: 7500 },
      ]);
    });

    it('rejects when bps do not sum to 10000', () => {
      expect(() =>
        computeShares(100, {
          type: 'percentage',
          shares: [{ memberId: A, percentBps: 9999 }],
        }),
      ).toThrow(/10000 bps/);
    });

    it('reconciles rounding on uneven percentages (33.33/33.33/33.34)', () => {
      const r = computeShares(100, {
        type: 'percentage',
        shares: [
          { memberId: A, percentBps: 3333 },
          { memberId: B, percentBps: 3333 },
          { memberId: C, percentBps: 3334 },
        ],
      });
      expect(total(r)).toBe(100);
      expect(r.map((s) => s.shareMinor).sort()).toEqual([33, 33, 34]);
    });

    it('never loses a cent across odd totals', () => {
      for (const amount of [1, 3, 7, 99, 101, 12345]) {
        const r = computeShares(amount, {
          type: 'percentage',
          shares: [
            { memberId: A, percentBps: 3333 },
            { memberId: B, percentBps: 3333 },
            { memberId: C, percentBps: 3334 },
          ],
        });
        expect(total(r)).toBe(amount);
        expect(r.every((s) => s.shareMinor >= 0)).toBe(true);
      }
    });
  });

  describe('shares (units)', () => {
    it('splits proportionally to units', () => {
      const r = computeShares(300, {
        type: 'shares',
        shares: [
          { memberId: A, units: 2 },
          { memberId: B, units: 1 },
        ],
      });
      expect(r).toEqual([
        { memberId: A, shareMinor: 200 },
        { memberId: B, shareMinor: 100 },
      ]);
    });

    it('reconciles remainders exactly', () => {
      const r = computeShares(100, {
        type: 'shares',
        shares: [
          { memberId: A, units: 1 },
          { memberId: B, units: 1 },
          { memberId: C, units: 1 },
        ],
      });
      expect(total(r)).toBe(100);
    });

    it('rejects absurd unit totals to protect integer math', () => {
      expect(() =>
        computeShares(100, {
          type: 'shares',
          shares: [{ memberId: A, units: 2_000_000 }],
        }),
      ).toThrow(/units/);
    });
  });

  describe('itemized', () => {
    it('splits each item equally and aggregates per member', () => {
      // Starter ₹300 shared by A+B; mains ₹500 only B; dessert ₹200 only A.
      const r = computeShares(1000, {
        type: 'itemized',
        items: [
          { description: 'Starter', amountMinor: 300, participantMemberIds: [A, B] },
          { description: 'Mains', amountMinor: 500, participantMemberIds: [B] },
          { description: 'Dessert', amountMinor: 200, participantMemberIds: [A] },
        ],
      });
      expect(total(r)).toBe(1000);
      expect(r.find((s) => s.memberId === A)?.shareMinor).toBe(350); // 150 + 200
      expect(r.find((s) => s.memberId === B)?.shareMinor).toBe(650); // 150 + 500
    });

    it('rejects items that do not sum to the total', () => {
      expect(() =>
        computeShares(1000, {
          type: 'itemized',
          items: [{ description: 'Starter', amountMinor: 999, participantMemberIds: [A] }],
        }),
      ).toThrow(/must sum to the total/);
    });

    it('reconciles rounding within each item (no lost paise)', () => {
      const r = computeShares(101, {
        type: 'itemized',
        items: [{ description: 'Odd item', amountMinor: 101, participantMemberIds: [A, B, C] }],
      });
      expect(total(r)).toBe(101);
      expect(r.map((s) => s.shareMinor).sort()).toEqual([33, 34, 34]);
    });

    it('rejects a duplicate participant within one item', () => {
      expect(() =>
        computeShares(100, {
          type: 'itemized',
          items: [{ description: 'Dup', amountMinor: 100, participantMemberIds: [A, A] }],
        }),
      ).toThrow(SplitError);
    });

    it('allows the same member across many items (shares aggregate)', () => {
      const r = computeShares(300, {
        type: 'itemized',
        items: [
          { description: 'One', amountMinor: 100, participantMemberIds: [A] },
          { description: 'Two', amountMinor: 200, participantMemberIds: [A] },
        ],
      });
      expect(r).toEqual([{ memberId: A, shareMinor: 300 }]);
    });

    it('property: itemized totals always reconcile across odd splits', () => {
      for (const amounts of [
        [1, 1, 1],
        [7, 13, 80],
        [333, 333, 334],
      ]) {
        const totalAmount = amounts.reduce((s, x) => s + x, 0);
        const r = computeShares(totalAmount, {
          type: 'itemized',
          items: amounts.map((amountMinor, i) => ({
            description: `Item ${i}`,
            amountMinor,
            participantMemberIds: [A, B, C],
          })),
        });
        expect(total(r)).toBe(totalAmount);
        expect(r.every((s) => s.shareMinor >= 0)).toBe(true);
      }
    });
  });

  it('rejects non-positive or fractional totals', () => {
    expect(() => computeShares(0, { type: 'equal', participantMemberIds: [A] })).toThrow(
      SplitError,
    );
    expect(() => computeShares(-5, { type: 'equal', participantMemberIds: [A] })).toThrow(
      SplitError,
    );
    expect(() => computeShares(10.5, { type: 'equal', participantMemberIds: [A] })).toThrow(
      SplitError,
    );
  });

  it('property: shares always sum to the total for random-ish inputs', () => {
    const members = [A, B, C];
    for (let amount = 1; amount <= 200; amount += 7) {
      const eq = computeShares(amount, { type: 'equal', participantMemberIds: members });
      expect(total(eq)).toBe(amount);
      const sh = computeShares(amount, {
        type: 'shares',
        shares: [
          { memberId: A, units: 3 },
          { memberId: B, units: 5 },
          { memberId: C, units: 7 },
        ],
      });
      expect(total(sh)).toBe(amount);
    }
  });
});
