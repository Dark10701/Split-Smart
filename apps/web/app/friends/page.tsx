'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { api, ApiError, formatMoney } from '../../lib/api';
import { computeFriends, type FriendBalance } from '../../lib/balances';
import { AppShell, Avatar, SkeletonList, ErrorState } from '../../components/ui';

export default function FriendsPage() {
  const { token, ready, signOut } = useAuth();
  const router = useRouter();
  const [friends, setFriends] = useState<FriendBalance[]>([]);
  const [currency, setCurrency] = useState('INR');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [me, groups] = await Promise.all([api.me(token), api.listGroups(token)]);
      const bundles = await Promise.all(
        groups.map(async (g) => ({
          group: await api.getGroup(token, g.id),
          balances: await api.getBalances(token, g.id),
        })),
      );
      setFriends(computeFriends(me, bundles));
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

  const active = friends.filter((f) => f.netMinor !== 0);
  const settled = friends.filter((f) => f.netMinor === 0);
  const overall = friends.reduce((sum, f) => sum + f.netMinor, 0);

  return (
    <AppShell title="Friends" active="friends">
      {loading ? (
        <>
          <div className="skeleton" style={{ height: 92, marginBottom: 16 }} />
          <SkeletonList rows={3} />
        </>
      ) : loadError ? (
        <ErrorState message="Could not load your friends" onRetry={() => void load()} />
      ) : friends.length === 0 ? (
        <div className="card empty">
          <div className="empty-emoji">🧑‍🤝‍🧑</div>
          <div style={{ fontWeight: 600, color: 'var(--text)' }}>No friends yet</div>
          <div>Add people to a group and your shared balances show up here.</div>
        </div>
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

          {active.length > 0 && (
            <>
              <div className="section-title" style={{ margin: '20px 0 8px' }}>
                Balances
              </div>
              <div className="stack" style={{ gap: 10 }}>
                {active.map((f) => (
                  <FriendRow key={f.key} f={f} />
                ))}
              </div>
            </>
          )}

          {settled.length > 0 && (
            <>
              <div className="section-title" style={{ margin: '20px 0 8px' }}>
                Settled up
              </div>
              <div className="stack" style={{ gap: 10 }}>
                {settled.map((f) => (
                  <FriendRow key={f.key} f={f} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </AppShell>
  );
}

function FriendRow({ f }: { f: FriendBalance }) {
  const owed = f.netMinor > 0;
  const settled = f.netMinor === 0;
  return (
    <div className="card card-pad between">
      <div className="row" style={{ gap: 13, minWidth: 0 }}>
        <Avatar name={f.name} size={46} color={f.avatarColor} />
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
            {f.name}
          </div>
          <div className="faint" style={{ fontSize: 12 }}>
            {settled
              ? 'all settled'
              : f.groups.length === 1
                ? f.groups[0]
                : `${f.groups.length} groups`}
          </div>
        </div>
      </div>
      <div className="bal-side">
        {settled ? (
          <span className="faint amount" style={{ fontSize: 13 }}>
            settled
          </span>
        ) : (
          <>
            <div className="l">{owed ? 'owes you' : 'you owe'}</div>
            <div className={`v ${owed ? 'pos' : 'neg'}`}>
              {formatMoney(Math.abs(f.netMinor), f.currency)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
