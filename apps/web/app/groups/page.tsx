'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { api, type Group } from '../../lib/api';
import { AppShell, Avatar, SkeletonList, ErrorState } from '../../components/ui';

export default function GroupsPage() {
  const { token, ready, signOut } = useAuth();
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [name, setName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setGroups(await api.listGroups(token));
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
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
    setCreateError(null);
    setCreating(true);
    try {
      await api.createGroup(token, name.trim());
      setName('');
      await refresh();
    } catch {
      setCreateError('Could not create the group. Is the API running?');
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
      <div className="between" style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 24 }}>Your groups</h1>
        {!loading && !loadError && groups.length > 0 && (
          <span className="badge badge-primary">{groups.length}</span>
        )}
      </div>

      <div className="card card-pad" style={{ marginBottom: 18 }}>
        <label className="label" htmlFor="new-group">
          Create a group
        </label>
        <div className="row">
          <input
            id="new-group"
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
        {createError && (
          <p className="error" style={{ marginTop: 10, marginBottom: 0 }}>
            {createError}
          </p>
        )}
      </div>

      {loading ? (
        <SkeletonList rows={3} />
      ) : loadError ? (
        <ErrorState message="Could not load your groups" onRetry={() => void refresh()} />
      ) : groups.length === 0 ? (
        <div className="card empty">
          <div className="empty-emoji">👋</div>
          <div style={{ fontWeight: 600, color: 'var(--text)' }}>No groups yet</div>
          <div>Create one above to start splitting expenses with friends.</div>
        </div>
      ) : (
        <div className="stack" style={{ gap: 10 }}>
          {groups.map((g) => (
            <a
              key={g.id}
              href={`/groups/${g.id}`}
              className="card card-pad card-hover between"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div className="row" style={{ gap: 13 }}>
                <Avatar name={g.name} size={44} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{g.name}</div>
                  <span className="badge" style={{ marginTop: 2 }}>
                    {g.defaultCurrency}
                  </span>
                </div>
              </div>
              <span className="faint" aria-hidden>
                →
              </span>
            </a>
          ))}
        </div>
      )}
    </AppShell>
  );
}
