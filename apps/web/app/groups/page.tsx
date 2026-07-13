'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { api, type Group } from '../../lib/api';

export default function GroupsPage() {
  const { token, ready, signOut } = useAuth();
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      setGroups(await api.listGroups(token));
      setError(null);
    } catch {
      setError('Could not load groups');
    }
  }, [token]);

  useEffect(() => {
    if (ready && !token) router.push('/login');
  }, [ready, token, router]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = async (): Promise<void> => {
    if (!token || !name.trim()) return;
    await api.createGroup(token, name.trim());
    setName('');
    await refresh();
  };

  return (
    <main style={{ maxWidth: 640, margin: '48px auto', padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h1>Your groups</h1>
        <button onClick={signOut}>Sign out</button>
      </div>
      <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New group name"
          style={{ flex: 1, padding: 10 }}
        />
        <button onClick={() => void create()} style={{ padding: '10px 16px' }}>
          Add
        </button>
      </div>
      {error && <p style={{ color: '#DC2626' }}>{error}</p>}
      <ul>
        {groups.map((g) => (
          <li key={g.id}>
            <a href={`/groups/${g.id}`}>{g.name}</a>{' '}
            <span style={{ color: '#6B7280' }}>({g.defaultCurrency})</span>
          </li>
        ))}
        {groups.length === 0 && <p style={{ color: '#6B7280' }}>No groups yet.</p>}
      </ul>
    </main>
  );
}
