import { memberName, type GroupDetail, type GroupBalances, type Expense, type Me } from './api';

/** My net position toward one other person, aggregated across shared groups. */
export interface FriendBalance {
  /** Stable identity: the linked userId, else `guest:<memberId>` for guests. */
  key: string;
  name: string;
  avatarColor: string | null;
  /** What I owe them (minor units, ≥ 0). */
  iOweMinor: number;
  /** What they owe me (minor units, ≥ 0). */
  owesMeMinor: number;
  /** owesMe − iOwe. Positive = they owe me; negative = I owe them. */
  netMinor: number;
  currency: string;
  /** Names of the groups this balance spans, for context. */
  groups: string[];
}

export interface GroupBundle {
  group: GroupDetail;
  balances: GroupBalances;
}

/**
 * Aggregate per-friend balances from the app's own simplified settle-up graph,
 * so the Friends screen stays consistent with the settle-up suggestions shown
 * inside each group. A settlement `from → to` means `from` owes `to`; we keep
 * only the ones that involve me and attribute them to the other person.
 */
export function computeFriends(me: Me, bundles: GroupBundle[]): FriendBalance[] {
  const byFriend = new Map<string, FriendBalance>();

  for (const { group, balances } of bundles) {
    const myMember = group.members.find((m) => m.userId === me.id);
    if (!myMember) continue;

    const upsert = (otherMemberId: string): FriendBalance => {
      const m = group.members.find((x) => x.id === otherMemberId);
      const key = m?.userId ? `user:${m.userId}` : `guest:${otherMemberId}`;
      let f = byFriend.get(key);
      if (!f) {
        f = {
          key,
          name: memberName(group.members, otherMemberId),
          avatarColor: m?.user?.avatarColor ?? null,
          iOweMinor: 0,
          owesMeMinor: 0,
          netMinor: 0,
          currency: group.defaultCurrency,
          groups: [],
        };
        byFriend.set(key, f);
      }
      if (!f.groups.includes(group.name)) f.groups.push(group.name);
      return f;
    };

    for (const t of balances.settlements) {
      if (t.currency !== group.defaultCurrency) continue;
      if (t.fromMemberId === myMember.id) {
        upsert(t.toMemberId).iOweMinor += t.amountMinor;
      } else if (t.toMemberId === myMember.id) {
        upsert(t.fromMemberId).owesMeMinor += t.amountMinor;
      }
    }
  }

  const friends = [...byFriend.values()];
  for (const f of friends) f.netMinor = f.owesMeMinor - f.iOweMinor;
  // Settled friends last; otherwise biggest absolute balance first.
  return friends.sort((a, b) => Math.abs(b.netMinor) - Math.abs(a.netMinor));
}

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
