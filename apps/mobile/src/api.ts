import Constants from 'expo-constants';

export const API_URL =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? 'http://localhost:3001';

export interface Me { id: string; email: string; name: string; defaultCurrency: string }
export interface Group { id: string; name: string; defaultCurrency: string; createdAt: string }
export interface GroupMember { id: string; userId: string | null; guestName: string | null; role: string }
export interface GroupDetail extends Group { members: GroupMember[] }

export type SplitMethod = 'equal' | 'exact' | 'percentage' | 'shares';

export interface ExpenseSplit { id: string; memberId: string; shareMinor: number }
export interface Expense {
  id: string;
  groupId: string;
  payerMemberId: string;
  amountMinor: number;
  currency: string;
  category: string | null;
  description: string;
  occurredAt: string;
  splitType: SplitMethod | 'itemized';
  version: number;
  splits: ExpenseSplit[];
}
export interface ExpensePage { items: Expense[]; nextCursor: string | null }

export type SplitPayload =
  | { type: 'equal'; participantMemberIds: string[] }
  | { type: 'exact'; shares: Array<{ memberId: string; amountMinor: number }> }
  | { type: 'percentage'; shares: Array<{ memberId: string; percentBps: number }> }
  | { type: 'shares'; shares: Array<{ memberId: string; units: number }> };

export interface CreateExpenseBody {
  description: string;
  amountMinor: number;
  currency: string;
  payerMemberId: string;
  category?: string;
  occurredAt: string;
  split: SplitPayload;
}

/** currency -> memberId -> net minor units (positive = owed, negative = owes). */
export type NetBalances = Record<string, Record<string, number>>;
export interface Transfer { fromMemberId: string; toMemberId: string; amountMinor: number; currency: string }
export interface GroupBalances { nets: NetBalances; settlements: Transfer[] }

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
  listGroups: (token: string) =>
    fetch(`${API_URL}/groups`, { headers: headers(token) }).then(unwrap<Group[]>),
  createGroup: (token: string, name: string, defaultCurrency?: string) =>
    fetch(`${API_URL}/groups`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({ name, ...(defaultCurrency ? { defaultCurrency } : {}) }),
    }).then(unwrap<Group>),
  getGroup: (token: string, id: string) =>
    fetch(`${API_URL}/groups/${id}`, { headers: headers(token) }).then(unwrap<GroupDetail>),
  createInvite: (token: string, id: string, email?: string) =>
    fetch(`${API_URL}/groups/${id}/invite`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify(email ? { email } : {}),
    }).then(unwrap<{ token: string }>),
  join: (token: string, inviteToken: string) =>
    fetch(`${API_URL}/groups/join`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({ token: inviteToken }),
    }).then(unwrap<GroupMember>),
  listExpenses: (token: string, groupId: string, cursor?: string) =>
    fetch(
      `${API_URL}/groups/${groupId}/expenses` + (cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''),
      { headers: headers(token) },
    ).then(unwrap<ExpensePage>),
  createExpense: (token: string, groupId: string, body: CreateExpenseBody) =>
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
};
