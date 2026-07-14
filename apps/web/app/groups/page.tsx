'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { api, type Group } from '../../lib/api';
import { AppShell, Avatar } from '../../components/ui';

export default function GroupsPage() {
  const { token, ready, signOut } = useAuth();
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

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
    setCreating(true);
    try {
      await api.createGroup(token, name.trim());
      setName('');
      await refresh();
    } finally {
      setCreating(false);
    }
  };

  return (
    <AppShell
      title="SplitSmart"
      active="home"
      headerRight={
        <button className="btn btn-ghost btn-sm" onClick={signOut}>
          Sign out
        </button>
      }
    >
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>Your groups</h1>

      <div className="card card-pad" style={{ marginBottom: 18 }}>
        <label className="label">Create a group</label>
        <div className="row">
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void create()}
            placeholder="e.g. Goa Trip, Flat 4B"
          />
          <button
            className="btn btn-primary"
            onClick={() => void create()}
            disabled={!name.trim() || creating}
          >
            {creating ? 'Creating…' : 'Create'}
          </button>
        </div>
        {error && (
          <p className="error" style={{ marginTop: 10, marginBottom: 0 }}>
            {error}
          </p>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="card empty">
          <div className="empty-emoji">👋</div>
          <div style={{ fontWeight: 600, color: 'var(--text)' }}>No groups yet</div>
          <div>Create one above to start tracking shared expenses.</div>
        </div>
      ) : (
        <div className="stack" style={{ gap: 10 }}>
          {groups.map((g) => (
            <a
              key={g.id}
              href={`/groups/${g.id}`}
              className="card card-pad between"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div className="row" style={{ gap: 13 }}>
                <Avatar name={g.name} size={40} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{g.name}</div>
                  <div className="faint" style={{ fontSize: 13 }}>
                    {g.defaultCurrency}
                  </div>
                </div>
              </div>
              <span className="faint">→</span>
            </a>
          ))}
        </div>
      )}
    </AppShell>
  );
}
