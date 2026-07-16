'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { api, ApiError, formatMoney, type Group } from '../../lib/api';
import { AppShell, Avatar, Modal, SkeletonList, ErrorState } from '../../components/ui';

/** A group plus this user's net balance in it (positive = owed to you). */
interface GroupRow {
  group: Group;
  net: number | null;
  currency: string;
}

export default function GroupsPage() {
  const { token, ready, signOut } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [me, groups] = await Promise.all([api.me(token), api.listGroups(token)]);
      // For each group, resolve this user's net from the balance engine.
      const withBalances = await Promise.all(
        groups.map(async (group): Promise<GroupRow> => {
          try {
            const [detail, balances] = await Promise.all([
              api.getGroup(token, group.id),
              api.getBalances(token, group.id),
            ]);
            const mine = detail.members.find((m) => m.userId === me.id);
            const net = mine ? (balances.nets[group.defaultCurrency]?.[mine.id] ?? 0) : 0;
            return { group, net, currency: group.defaultCurrency };
          } catch {
            return { group, net: null, currency: group.defaultCurrency };
          }
        }),
      );
      setRows(withBalances);
      setLoadError(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        signOut();
        router.push('/login');
        return;
      }
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

  // Overall position across groups sharing the primary currency (INR v1).
  const currency = rows[0]?.currency ?? 'INR';
  const overall = rows.reduce((sum, r) => sum + (r.net ?? 0), 0);

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
      {loading ? (
        <>
          <div className="skeleton" style={{ height: 92, marginBottom: 16 }} />
          <SkeletonList rows={3} />
        </>
      ) : loadError ? (
        <ErrorState message="Could not load your groups" onRetry={() => void refresh()} />
      ) : (
        <>
          <OverallHero overall={overall} currency={currency} hasGroups={rows.length > 0} />

          {rows.length === 0 ? (
            <div className="card empty" style={{ marginTop: 16 }}>
              <div className="empty-emoji">👋</div>
              <div style={{ fontWeight: 600, color: 'var(--text)' }}>No groups yet</div>
              <div>Create your first group to start splitting expenses with friends.</div>
              <button
                className="btn btn-primary"
                style={{ marginTop: 16 }}
                onClick={() => setCreating(true)}
              >
                Create a group
              </button>
            </div>
          ) : (
            <div className="section-title" style={{ margin: '20px 0 8px' }}>
              Your groups
            </div>
          )}

          <div className="stack" style={{ gap: 10 }}>
            {rows.map(({ group, net, currency }) => (
              <a
                key={group.id}
                href={`/groups/${group.id}`}
                className="card card-pad card-hover between"
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div className="row" style={{ gap: 13, minWidth: 0 }}>
                  <Avatar name={group.name} size={46} />
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 16,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {group.name}
                    </div>
                    <div className="faint" style={{ fontSize: 13 }}>
                      {net === null
                        ? group.defaultCurrency
                        : net === 0
                          ? 'settled up'
                          : net > 0
                            ? 'you are owed'
                            : 'you owe'}
                    </div>
                  </div>
                </div>
                {net !== null && net !== 0 ? (
                  <div className="bal-side">
                    <div className={`v ${net > 0 ? 'pos' : 'neg'}`}>
                      {formatMoney(Math.abs(net), currency)}
                    </div>
                  </div>
                ) : (
                  <span className="faint" aria-hidden style={{ fontSize: 18 }}>
                    ›
                  </span>
                )}
              </a>
            ))}
          </div>
        </>
      )}

      {rows.length > 0 && (
        <button className="fab" onClick={() => setCreating(true)}>
          + New group
        </button>
      )}

      {creating && token && (
        <CreateGroupModal
          token={token}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            void refresh();
          }}
        />
      )}
    </AppShell>
  );
}

function OverallHero({
  overall,
  currency,
  hasGroups,
}: {
  overall: number;
  currency: string;
  hasGroups: boolean;
}) {
  if (!hasGroups) return null;
  if (overall === 0) {
    return (
      <div className="hero">
        <div className="hero-label">Overall</div>
        <div className="hero-amount">You&apos;re all settled up 🎉</div>
      </div>
    );
  }
  const owed = overall > 0;
  return (
    <div className="hero">
      <div className="hero-label">{owed ? 'Overall, you are owed' : 'Overall, you owe'}</div>
      <div className={`hero-amount ${owed ? 'pos' : 'neg'}`}>
        {formatMoney(Math.abs(overall), currency)}
      </div>
    </div>
  );
}

function CreateGroupModal({
  token,
  onClose,
  onCreated,
}: {
  token: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const create = async (): Promise<void> => {
    if (!name.trim()) return;
    setError(null);
    setSaving(true);
    try {
      await api.createGroup(token, name.trim());
      onCreated();
    } catch {
      setError('Could not create the group. Is the API running?');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="New group" onClose={onClose}>
      <div className="field">
        <label className="label" htmlFor="new-group">
          Group name
        </label>
        <input
          id="new-group"
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void create()}
          placeholder="e.g. Goa Trip, Flat 4B"
          autoFocus
        />
      </div>
      {error && <p className="error">{error}</p>}
      <button
        className="btn btn-primary btn-block"
        onClick={() => void create()}
        disabled={!name.trim() || saving}
        style={{ marginTop: 6 }}
      >
        {saving ? 'Creating…' : 'Create group'}
      </button>
    </Modal>
  );
}
