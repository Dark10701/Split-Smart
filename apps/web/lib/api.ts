export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface Group {
  id: string;
  name: string;
  defaultCurrency: string;
  createdAt: string;
}
export interface GroupMember {
  id: string;
  userId: string | null;
  guestName: string | null;
  role: string;
  /** Display name + UPI VPA of the linked account (null for guests). */
  user: { name: string; upiId: string | null } | null;
}
export interface GroupDetail extends Group {
  members: GroupMember[];
}

export interface ExpenseSplit {
  id: string;
  memberId: string;
  shareMinor: number;
}
export interface Expense {
  id: string;
  payerMemberId: string;
  amountMinor: number;
  currency: string;
  description: string;
  splitType: string;
  occurredAt: string;
  splits: ExpenseSplit[];
}
export interface ExpensePage {
  items: Expense[];
  nextCursor: string | null;
}

export type SplitPayload =
  | { type: 'equal'; participantMemberIds: string[] }
  | { type: 'exact'; shares: Array<{ memberId: string; amountMinor: number }> }
  | { type: 'percentage'; shares: Array<{ memberId: string; percentBps: number }> }
  | { type: 'shares'; shares: Array<{ memberId: string; units: number }> };

export interface Transfer {
  fromMemberId: string;
  toMemberId: string;
  amountMinor: number;
  currency: string;
}
export interface GroupBalances {
  nets: Record<string, Record<string, number>>;
  settlements: Transfer[];
}

function headers(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

export const api = {
  listGroups: (token: string) =>
    fetch(`${API_URL}/groups`, { headers: headers(token) }).then(unwrap<Group[]>),
  createGroup: (token: string, name: string) =>
    fetch(`${API_URL}/groups`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({ name }),
    }).then(unwrap<Group>),
  getGroup: (token: string, id: string) =>
    fetch(`${API_URL}/groups/${id}`, { headers: headers(token) }).then(unwrap<GroupDetail>),
  listExpenses: (token: string, groupId: string) =>
    fetch(`${API_URL}/groups/${groupId}/expenses`, { headers: headers(token) }).then(
      unwrap<ExpensePage>,
    ),
  createExpense: (
    token: string,
    groupId: string,
    body: {
      description: string;
      amountMinor: number;
      currency: string;
      payerMemberId: string;
      occurredAt: string;
      split: SplitPayload;
    },
  ) =>
    fetch(`${API_URL}/groups/${groupId}/expenses`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify(body),
    }).then(unwrap<Expense>),
  getBalances: (token: string, groupId: string) =>
    fetch(`${API_URL}/groups/${groupId}/balances`, { headers: headers(token) }).then(
      unwrap<GroupBalances>,
    ),
};

/** Format integer minor units + currency, e.g. 1234 USD -> "$12.34". */
export function formatMoney(amountMinor: number, currency: string): string {
  const symbols: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥' };
  const zeroDecimal = new Set(['JPY', 'KRW', 'VND']);
  const symbol = symbols[currency] ?? '';
  const sign = amountMinor < 0 ? '-' : '';
  const abs = Math.abs(amountMinor);
  const major = zeroDecimal.has(currency) ? String(abs) : (abs / 100).toFixed(2);
  return `${sign}${symbol}${major}${symbol ? '' : ` ${currency}`}`;
}
