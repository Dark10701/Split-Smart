import { memberName, type GroupDetail, type GroupBalances, type Expense } from './api';

// Per-friend aggregation now lives server-side (GET /me/friend-balances); this
// module keeps only the balance-sheet builder used by the PDF/CSV export.

// ---------------------------------------------------------------------------
// Group balance sheet
// ---------------------------------------------------------------------------

export interface MemberSheetRow {
  memberId: string;
  name: string;
  /** Total this member paid out (they were the payer). */
  contributedMinor: number;
  /** Total this member's share of expenses (what they consumed). */
  shareMinor: number;
  /** Net position: contributed − share. Positive = owed to them. */
  netMinor: number;
}

export interface OutstandingRow {
  fromName: string;
  toName: string;
  amountMinor: number;
}

export interface ExpenseRow {
  date: string; // ISO
  description: string;
  payerName: string;
  amountMinor: number;
}

export interface BalanceSheet {
  groupName: string;
  currency: string;
  generatedAt: string;
  totalExpensesMinor: number;
  members: MemberSheetRow[];
  outstanding: OutstandingRow[];
  expenses: ExpenseRow[];
}

/** Build a full balance sheet for one group from its expenses + balances. */
export function buildBalanceSheet(
  group: GroupDetail,
  expenses: Expense[],
  balances: GroupBalances,
): BalanceSheet {
  const currency = group.defaultCurrency;

  const rows: MemberSheetRow[] = group.members.map((m) => ({
    memberId: m.id,
    name: memberName(group.members, m.id),
    contributedMinor: 0,
    shareMinor: 0,
    netMinor: 0,
  }));
  const rowById = new Map(rows.map((r) => [r.memberId, r]));

  let totalExpensesMinor = 0;
  const expenseRows: ExpenseRow[] = [];

  for (const e of expenses) {
    totalExpensesMinor += e.amountMinor;
    const payerRow = rowById.get(e.payerMemberId);
    if (payerRow) payerRow.contributedMinor += e.amountMinor;
    for (const s of e.splits) {
      const r = rowById.get(s.memberId);
      if (r) r.shareMinor += s.shareMinor;
    }
    expenseRows.push({
      date: e.occurredAt,
      description: e.description,
      payerName: memberName(group.members, e.payerMemberId),
      amountMinor: e.amountMinor,
    });
  }
  for (const r of rows) r.netMinor = r.contributedMinor - r.shareMinor;

  expenseRows.sort((a, b) => +new Date(b.date) - +new Date(a.date));

  const outstanding: OutstandingRow[] = balances.settlements
    .filter((t) => t.currency === currency)
    .map((t) => ({
      fromName: memberName(group.members, t.fromMemberId),
      toName: memberName(group.members, t.toMemberId),
      amountMinor: t.amountMinor,
    }));

  return {
    groupName: group.name,
    currency,
    generatedAt: new Date().toISOString(),
    totalExpensesMinor,
    members: rows,
    outstanding,
    expenses: expenseRows,
  };
}
