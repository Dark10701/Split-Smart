'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import {
  api,
  ApiError,
  formatMoney,
  type FriendsOverview,
  type FriendSearchHit,
  type PublicUser,
} from '../../lib/api';
import { computeFriends, type FriendBalance } from '../../lib/balances';
import { openUpiPayment } from '../../lib/upi';
import {
  AppShell,
  Avatar,
  Modal,
  SkeletonList,
  ErrorState,
  Toast,
  type ToastState,
} from '../../components/ui';

export default function FriendsPage() {
  const { token, ready, signOut } = useAuth();
  const router = useRouter();
  const [balances, setBalances] = useState<FriendBalance[]>([]);
  const [overview, setOverview] = useState<FriendsOverview | null>(null);
  const [currency, setCurrency] = useState('INR');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [me, groups, ov] = await Promise.all([
        api.me(token),
        api.listGroups(token),
        api.friendsOverview(token),
      ]);
      const bundles = await Promise.all(
        groups.map(async (g) => ({
          group: await api.getGroup(token, g.id),
          balances: await api.getBalances(token, g.id),
        })),
      );
      setBalances(computeFriends(me, bundles));
      setOverview(ov);
      setCurrency(groups[0]?.defaultCurrency ?? 'INR');
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
    void load();
  }, [load]);

  const act = async (fn: () => Promise<unknown>, okMessage: string): Promise<void> => {
    try {
      await fn();
      setToast({ message: okMessage, kind: 'success' });
      void load();
    } catch {
      setToast({ message: 'That did not work — try again', kind: 'error' });
    }
  };

  const balanceByUserId = new Map(
    balances.filter((b) => b.key.startsWith('user:')).map((b) => [b.key.slice(5), b]),
  );
  const guestBalances = balances.filter((b) => b.key.startsWith('guest:') && b.netMinor !== 0);
  const overall = balances.reduce((sum, f) => sum + f.netMinor, 0);
  const friendIds = new Set((overview?.friends ?? []).map((f) => f.id));
  // Balance rows for people I share groups with but haven't friended yet.
  const unfriendedBalances = balances.filter(
    (b) => b.key.startsWith('user:') && !friendIds.has(b.key.slice(5)) && b.netMinor !== 0,
  );

  return (
    <AppShell
      title="Friends"
      active="friends"
      headerRight={
        <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>
          + Add friend
        </button>
      }
    >
      {loading ? (
        <>
          <div className="skeleton" style={{ height: 92, marginBottom: 16 }} />
          <SkeletonList rows={3} />
        </>
      ) : loadError ? (
        <ErrorState message="Could not load your friends" onRetry={() => void load()} />
      ) : (
        <>
          <div className="hero">
            <div className="hero-label">
              {overall === 0
                ? 'Overall'
                : overall > 0
                  ? 'Overall, you are owed'
                  : 'Overall, you owe'}
            </div>
            <div className={`hero-amount ${overall > 0 ? 'pos' : overall < 0 ? 'neg' : ''}`}>
              {overall === 0
                ? "You're all settled up 🎉"
                : formatMoney(Math.abs(overall), currency)}
            </div>
          </div>

          {overview && overview.incoming.length > 0 && (
            <>
              <div className="section-title" style={{ margin: '20px 0 8px' }}>
                Friend requests
              </div>
              <div className="stack" style={{ gap: 10 }}>
                {overview.incoming.map(({ friendshipId, user }) => (
                  <div key={friendshipId} className="card card-pad between">
                    <PersonCell user={user} sub={user.phone ?? user.email} />
                    <div className="row" style={{ gap: 8, flexShrink: 0 }}>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() =>
                          void act(
                            () => api.respondFriendRequest(token!, friendshipId, true),
                            `You and ${user.name} are now friends`,
                          )
                        }
                      >
                        Accept
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() =>
                          void act(
                            () => api.respondFriendRequest(token!, friendshipId, false),
                            'Request removed',
                          )
                        }
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {overview && overview.friends.length === 0 && balances.length === 0 ? (
            <div className="card empty" style={{ marginTop: 16 }}>
              <div className="empty-emoji">🧑‍🤝‍🧑</div>
              <div style={{ fontWeight: 600, color: 'var(--text)' }}>No friends yet</div>
              <div>Find friends by mobile number, email, or name and start splitting.</div>
              <button
                className="btn btn-primary"
                style={{ marginTop: 16 }}
                onClick={() => setAdding(true)}
              >
                Add your first friend
              </button>
            </div>
          ) : (
            <>
              <div className="section-title" style={{ margin: '20px 0 8px' }}>
                Friends
              </div>
              <div className="stack" style={{ gap: 10 }}>
                {(overview?.friends ?? []).map((u) => (
                  <FriendCard
                    key={u.id}
                    user={u}
                    balance={balanceByUserId.get(u.id) ?? null}
                    onRemove={() =>
                      void act(() => api.removeFriend(token!, u.id), `${u.name} removed`)
                    }
                    onBlock={() => void act(() => api.blockUser(token!, u.id), `${u.name} blocked`)}
                    onPaid={() =>
                      setToast({
                        message: 'UPI app opened — record the payment in the group after paying',
                        kind: 'success',
                      })
                    }
                  />
                ))}
                {unfriendedBalances.map((b) => (
                  <BalanceOnlyRow key={b.key} b={b} note="shares a group with you" />
                ))}
                {guestBalances.map((b) => (
                  <BalanceOnlyRow key={b.key} b={b} note="guest (no account)" />
                ))}
              </div>
            </>
          )}

          {overview && overview.outgoing.length > 0 && (
            <>
              <div className="section-title" style={{ margin: '20px 0 8px' }}>
                Sent requests
              </div>
              <div className="stack" style={{ gap: 10 }}>
                {overview.outgoing.map(({ friendshipId, user }) => (
                  <div key={friendshipId} className="card card-pad between">
                    <PersonCell user={user} sub="Pending" />
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() =>
                        void act(() => api.removeFriend(token!, user.id), 'Request cancelled')
                      }
                    >
                      Cancel
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {overview && overview.blocked.length > 0 && (
            <>
              <div className="section-title" style={{ margin: '20px 0 8px' }}>
                Blocked
              </div>
              <div className="stack" style={{ gap: 10 }}>
                {overview.blocked.map((u) => (
                  <div key={u.id} className="card card-pad between">
                    <PersonCell user={u} sub="Blocked" />
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => void act(() => api.unblockUser(token!, u.id), 'Unblocked')}
                    >
                      Unblock
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {adding && token && (
        <AddFriendModal
          token={token}
          onClose={() => setAdding(false)}
          onChanged={() => void load()}
        />
      )}
      <Toast toast={toast} onDone={() => setToast(null)} />
    </AppShell>
  );
}

function PersonCell({ user, sub }: { user: PublicUser; sub?: string | null }) {
  return (
    <div className="row" style={{ gap: 12, minWidth: 0 }}>
      <Avatar name={user.name} size={42} color={user.avatarColor} />
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontWeight: 700,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {user.name}
        </div>
        {sub && (
          <div className="faint" style={{ fontSize: 12 }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

/** A friend with balance context, one-tap UPI pay, and manage actions. */
function FriendCard({
  user,
  balance,
  onRemove,
  onBlock,
  onPaid,
}: {
  user: PublicUser;
  balance: FriendBalance | null;
  onRemove: () => void;
  onBlock: () => void;
  onPaid: () => void;
}) {
  const router = useRouter();
  const [managing, setManaging] = useState(false);
  const net = balance?.netMinor ?? 0;
  const iOweThem = net < 0;
  const groupForRecord = balance?.groups[0];

  const pay = (): void => {
    if (!user.upiId || !iOweThem) return;
    // Generic upi:// link → Android opens GPay/PhonePe/etc. or shows the
    // chooser when several are installed. Desktop users use the group's QR.
    openUpiPayment({
      payeeVpa: user.upiId,
      payeeName: user.name,
      amountPaise: Math.abs(net),
      note: 'SplitSmart settle-up',
    });
    onPaid();
  };

  return (
    <div className="card card-pad">
      <div className="between">
        <PersonCell
          user={user}
          sub={
            net === 0
              ? 'all settled'
              : balance && balance.groups.length === 1
                ? balance.groups[0]!.name
                : balance
                  ? `${balance.groups.length} groups`
                  : (user.phone ?? user.email)
          }
        />
        <div className="row" style={{ gap: 10, flexShrink: 0 }}>
          {net !== 0 && balance && (
            <div className="bal-side">
              <div className="l">{net > 0 ? 'owes you' : 'you owe'}</div>
              <div className={`v ${net > 0 ? 'pos' : 'neg'}`}>
                {formatMoney(Math.abs(net), balance.currency)}
              </div>
            </div>
          )}
          <button
            className="btn btn-ghost btn-sm"
            aria-label={`Manage ${user.name}`}
            aria-expanded={managing}
            onClick={() => setManaging((m) => !m)}
          >
            ⋯
          </button>
        </div>
      </div>

      {(iOweThem || managing) && (
        <div className="row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
          {iOweThem &&
            (user.upiId ? (
              <button className="btn btn-success btn-sm" onClick={pay}>
                Pay {formatMoney(Math.abs(net), balance!.currency)} via UPI
              </button>
            ) : (
              <span className="faint" style={{ fontSize: 12 }}>
                {user.name} hasn&apos;t added a UPI ID yet
              </span>
            ))}
          {iOweThem && groupForRecord && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => router.push(`/groups/${groupForRecord.id}`)}
            >
              Record settlement
            </button>
          )}
          {managing && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={onRemove}>
                Remove friend
              </button>
              <button className="btn btn-ghost btn-sm neg" onClick={onBlock}>
                Block
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Someone with a balance but no friendship (group-mate or guest). */
function BalanceOnlyRow({ b, note }: { b: FriendBalance; note: string }) {
  const owed = b.netMinor > 0;
  return (
    <div className="card card-pad between">
      <div className="row" style={{ gap: 12, minWidth: 0 }}>
        <Avatar name={b.name} size={42} color={b.avatarColor} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700 }}>{b.name}</div>
          <div className="faint" style={{ fontSize: 12 }}>
            {note}
          </div>
        </div>
      </div>
      <div className="bal-side">
        <div className="l">{owed ? 'owes you' : 'you owe'}</div>
        <div className={`v ${owed ? 'pos' : 'neg'}`}>
          {formatMoney(Math.abs(b.netMinor), b.currency)}
        </div>
      </div>
    </div>
  );
}

/** Search by mobile number, email, or name; act on each hit by state. */
function AddFriendModal({
  token,
  onClose,
  onChanged,
}: {
  token: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<FriendSearchHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async (): Promise<void> => {
    if (q.trim().length < 2) return;
    setBusy(true);
    setError(null);
    try {
      setHits(await api.searchFriends(token, q.trim()));
    } catch {
      setError('Search failed — is the API running?');
    } finally {
      setBusy(false);
    }
  };

  const request = async (hit: FriendSearchHit): Promise<void> => {
    setBusy(true);
    try {
      await api.sendFriendRequest(token, hit.id);
      setHits(
        (h) =>
          h?.map((x) => (x.id === hit.id ? { ...x, relationship: 'request_sent' as const } : x)) ??
          null,
      );
      onChanged();
    } catch {
      setError('Could not send the request');
    } finally {
      setBusy(false);
    }
  };

  const stateLabel: Record<FriendSearchHit['relationship'], string> = {
    none: 'Add',
    friends: 'Friends ✓',
    request_sent: 'Pending',
    request_received: 'Accept',
    blocked: 'Blocked',
  };

  return (
    <Modal title="Add a friend" onClose={onClose}>
      <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>
        Search by mobile number, email, or name.
      </p>
      <div className="row" style={{ marginBottom: 14 }}>
        <input
          className="input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void search()}
          placeholder="98765 43210 · friend@email.com · Maya"
          autoFocus
        />
        <button
          className="btn btn-primary"
          onClick={() => void search()}
          disabled={busy || q.trim().length < 2}
        >
          Search
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      {hits !== null && hits.length === 0 && (
        <p className="faint" style={{ fontSize: 13 }}>
          No one found. Phone and email must match exactly.
        </p>
      )}
      <div className="stack" style={{ gap: 8 }}>
        {(hits ?? []).map((hit) => (
          <div key={hit.id} className="between">
            <PersonCell user={hit} sub={hit.phone ?? hit.email} />
            <button
              className={`btn btn-sm ${hit.relationship === 'none' || hit.relationship === 'request_received' ? 'btn-primary' : 'btn-ghost'}`}
              disabled={
                busy ||
                hit.relationship === 'friends' ||
                hit.relationship === 'blocked' ||
                hit.relationship === 'request_sent'
              }
              onClick={() => void request(hit)}
            >
              {stateLabel[hit.relationship]}
            </button>
          </div>
        ))}
      </div>
    </Modal>
  );
}
