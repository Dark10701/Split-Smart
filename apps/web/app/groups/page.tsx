'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { api, ApiError, formatMoney, type Group } from '../../lib/api';
import {
  AppShell,
  Avatar,
  Modal,
  SkeletonList,
  ErrorState,
  Toast,
  type ToastState,
} from '../../components/ui';
import { Scene } from '../../components/Scene';

/** A group plus this user's net balance in it (positive = owed to you). */
interface GroupRow {
  group: Group;
  net: number | null;
  currency: string;
}

function greetingWord(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function GroupsPage() {
  const { token, ready, signOut } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<GroupRow[]>([]);
  const [firstName, setFirstName] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [me, groups] = await Promise.all([api.me(token), api.listGroups(token)]);
      setFirstName(me.name.split(/\s+/)[0] ?? me.name);
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
  const newestGroupId = rows[0]?.group.id;

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
          <div className="skeleton" style={{ height: 132, marginBottom: 16, borderRadius: 24 }} />
          <div className="skeleton" style={{ height: 84, marginBottom: 18, borderRadius: 18 }} />
          <SkeletonList rows={3} />
        </>
      ) : loadError ? (
        <ErrorState message="Could not load your groups" onRetry={() => void refresh()} />
      ) : (
        <>
          <div className="greeting">
            <h1>
              {greetingWord()}
              {firstName ? `, ${firstName}` : ''} 👋
            </h1>
            <div className="sub">Here&apos;s where your money stands.</div>
          </div>

          <Scene />

          <QuickActions onNewGroup={() => setCreating(true)} newestGroupId={newestGroupId} />

          <div style={{ marginTop: 18 }}>
            <BalanceHero overall={overall} currency={currency} hasGroups={rows.length > 0} />
          </div>

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
                Create your first group
              </button>
            </div>
          ) : (
            <div className="section-title" style={{ margin: '22px 0 8px' }}>
              Your groups
            </div>
          )}

          <div className="stack stagger" style={{ gap: 10 }}>
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
            setToast({ message: 'Group created', kind: 'success' });
            void refresh();
          }}
        />
      )}

      <Toast toast={toast} onDone={() => setToast(null)} />
    </AppShell>
  );
}

/** The gradient "total balance" showcase card. */
function BalanceHero({
  overall,
  currency,
  hasGroups,
}: {
  overall: number;
  currency: string;
  hasGroups: boolean;
}) {
  const owed = overall > 0;
  const settled = overall === 0;
  return (
    <div className="balance-hero">
      <div className="bh-label">
        {!hasGroups || settled ? 'Your balance' : owed ? 'You are owed overall' : 'You owe overall'}
      </div>
      <div className="bh-amount">
        {!hasGroups || settled
          ? formatMoney(0, currency)
          : formatMoney(Math.abs(overall), currency)}
      </div>
      <div className="bh-sub">
        {!hasGroups
          ? 'Create a group to start tracking shared expenses.'
          : settled
            ? "You're all settled up 🎉"
            : owed
              ? 'Money your friends still owe you.'
              : 'What you still need to settle.'}
      </div>
    </div>
  );
}

function ActionIcon({ path }: { path: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={path} />
    </svg>
  );
}

/** GPay-style row of rounded shortcut tiles for the most common actions. */
function QuickActions({
  onNewGroup,
  newestGroupId,
}: {
  onNewGroup: () => void;
  newestGroupId?: string;
}) {
  const router = useRouter();
  return (
    <div className="quick-grid" style={{ marginTop: 16 }}>
      <button className="quick-tile qt-green" onClick={onNewGroup}>
        <span className="qt-icon">
          <ActionIcon path="M12 5v14M5 12h14" />
        </span>
        New group
      </button>
      <button
        className="quick-tile"
        onClick={() => newestGroupId && router.push(`/groups/${newestGroupId}?new=1`)}
        disabled={!newestGroupId}
      >
        <span className="qt-icon">
          <ActionIcon path="M9 14h6M12 11v6M5 7h14M6 7l1 13a2 2 0 002 2h6a2 2 0 002-2l1-13M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2" />
        </span>
        Add expense
      </button>
      <a className="quick-tile" href="/friends">
        <span className="qt-icon">
          <ActionIcon path="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
        </span>
        Friends
      </a>
      <a className="quick-tile" href="/upi">
        <span className="qt-icon">
          <ActionIcon path="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM17 14v3M14 17h3M17 20v.01M20 17v3" />
        </span>
        My UPI
      </a>
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
