import { formatPaise } from '@splitsmart/types';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface Me {
  id: string;
  email: string;
  name: string;
  defaultCurrency: string;
  upiId: string | null;
}
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
export interface ExpenseItem {
  id: string;
  description: string;
  amountMinor: number;
  participantMemberIds: string[];
}
export interface Expense {
  id: string;
  payerMemberId: string;
  amountMinor: number;
  currency: string;
  description: string;
  splitType: string;
  occurredAt: string;
  version: number;
  splits: ExpenseSplit[];
  items: ExpenseItem[];
}
export interface ExpensePage {
  items: Expense[];
  nextCursor: string | null;
}

export type SplitPayload =
  | { type: 'equal'; participantMemberIds: string[] }
  | { type: 'exact'; shares: Array<{ memberId: string; amountMinor: number }> }
  | { type: 'percentage'; shares: Array<{ memberId: string; percentBps: number }> }
  | { type: 'shares'; shares: Array<{ memberId: string; units: number }> }
  | {
      type: 'itemized';
      items: Array<{ description: string; amountMinor: number; participantMemberIds: string[] }>;
    };

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

export interface Payment {
  id: string;
  fromMemberId: string;
  toMemberId: string;
  amountMinor: number;
  currency: string;
  method: string;
  status: string;
  createdAt: string;
}

export interface ActivityEntry {
  id: string;
  actorId: string;
  entityType: string;
  entityId: string;
  action: 'created' | 'updated' | 'deleted';
  payload: Record<string, unknown>;
  createdAt: string;
}
export interface ActivityPage {
  items: ActivityEntry[];
  nextCursor: string | null;
}

export interface Comment {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function headers(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return (await res.json()) as T;
}

export const api = {
  me: (token: string) => fetch(`${API_URL}/me`, { headers: headers(token) }).then(unwrap<Me>),
  updateMe: (token: string, body: { name?: string; upiId?: string | null }) =>
    fetch(`${API_URL}/me`, {
      method: 'PATCH',
      headers: headers(token),
      body: JSON.stringify(body),
    }).then(unwrap<Me>),
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
  joinGroup: (token: string, inviteToken: string) =>
    fetch(`${API_URL}/groups/join`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({ token: inviteToken }),
    }).then(unwrap<GroupMember>),
  createInvite: (token: string, id: string) =>
    fetch(`${API_URL}/groups/${id}/invite`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({}),
    }).then(unwrap<{ token: string }>),
  addGuest: (token: string, groupId: string, guestName: string) =>
    fetch(`${API_URL}/groups/${groupId}/members`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({ guestName }),
    }).then(unwrap<GroupMember>),
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
  deleteExpense: (token: string, groupId: string, expenseId: string) =>
    fetch(`${API_URL}/groups/${groupId}/expenses/${expenseId}`, {
      method: 'DELETE',
      headers: headers(token),
    }).then(unwrap<{ id: string }>),
  getBalances: (token: string, groupId: string) =>
    fetch(`${API_URL}/groups/${groupId}/balances`, { headers: headers(token) }).then(
      unwrap<GroupBalances>,
    ),
  recordSettlement: (
    token: string,
    groupId: string,
    body: {
      fromMemberId: string;
      toMemberId: string;
      amountMinor: number;
      currency: string;
      method: 'cash' | 'offline' | 'upi';
      idempotencyKey: string;
    },
  ) =>
    fetch(`${API_URL}/groups/${groupId}/settlements`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify(body),
    }).then(unwrap<Payment>),
  listActivity: (token: string, groupId: string) =>
    fetch(`${API_URL}/groups/${groupId}/activity`, { headers: headers(token) }).then(
      unwrap<ActivityPage>,
    ),
  listComments: (token: string, groupId: string, expenseId: string) =>
    fetch(`${API_URL}/groups/${groupId}/expenses/${expenseId}/comments`, {
      headers: headers(token),
    }).then(unwrap<Comment[]>),
  addComment: (token: string, groupId: string, expenseId: string, body: string) =>
    fetch(`${API_URL}/groups/${groupId}/expenses/${expenseId}/comments`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({ body }),
    }).then(unwrap<Comment>),
};

/** Format integer minor units + currency. INR uses Indian digit grouping. */
export function formatMoney(amountMinor: number, currency: string): string {
  if (currency === 'INR') return formatPaise(amountMinor);
  const sign = amountMinor < 0 ? '-' : '';
  return `${sign}${(Math.abs(amountMinor) / 100).toFixed(2)} ${currency}`;
}

/** Parse a decimal major-unit string into integer minor units, or null. */
export function toMinor(input: string): number | null {
  const t = input.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const [whole, frac = ''] = t.split('.');
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}

const AVATAR_COLORS = ['#4f46e5', '#0ea5e9', '#059669', '#d97706', '#db2777', '#7c3aed', '#dc2626'];

/** Deterministic avatar color + initials for a member. */
export function avatarFor(name: string): { color: string; initials: string } {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  return { color: AVATAR_COLORS[hash % AVATAR_COLORS.length]!, initials: initials || '?' };
}

export function memberName(members: GroupMember[], id: string): string {
  const m = members.find((x) => x.id === id);
  return m ? (m.user?.name ?? m.guestName ?? 'Member') : 'Unknown';
}

export function memberUpi(members: GroupMember[], id: string): string | null {
  return members.find((x) => x.id === id)?.user?.upiId ?? null;
}
