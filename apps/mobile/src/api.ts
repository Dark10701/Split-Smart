import Constants from 'expo-constants';

export const API_URL =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? 'http://localhost:3001';

export interface Me { id: string; email: string; name: string; defaultCurrency: string }
export interface Group { id: string; name: string; defaultCurrency: string; createdAt: string }
export interface GroupMember { id: string; userId: string | null; guestName: string | null; role: string }
export interface GroupDetail extends Group { members: GroupMember[] }

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
};
