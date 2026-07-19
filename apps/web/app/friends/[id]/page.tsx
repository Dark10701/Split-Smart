'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { useAuth } from '../../../lib/auth';
import {
  api,
  ApiError,
  formatMoney,
  type FriendProfile,
  type FriendBalance,
} from '../../../lib/api';
import { buildMyQrValue } from '../../../lib/upi';
import { AppShell, Avatar, SkeletonList, ErrorState } from '../../../components/ui';

/**
 * A friend's profile: identity, mutual groups, balance with you, and their
 * UPI QR in a full-screen view any UPI app can scan.
 */
export default function FriendProfilePage() {
  const { token, ready, signOut } = useAuth();
  const router = useRouter();
  const userId = useParams<{ id: string }>().id;

  const [profile, setProfile] = useState<FriendProfile | null>(null);
  const [balance, setBalance] = useState<FriendBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [qr, setQr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [p, balances] = await Promise.all([
        api.friendProfile(token, userId),
        api.friendBalances(token).catch(() => [] as FriendBalance[]),
      ]);
      setProfile(p);
      setBalance(balances.find((b) => b.key === `user:${userId}`) ?? null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        signOut();
        router.push('/login');
        return;
      }
      setError(
        e instanceof ApiError && e.status === 404
          ? 'This profile is not available.'
          : 'Could not load this profile. Check your connection and try again.',
      );
    } finally {
      setLoading(false);
    }
  }, [token, userId]);

  useEffect(() => {
    if (ready && !token) router.push('/login');
  }, [ready, token, router]);
  useEffect(() => {
    void load();
  }, [load]);

  // Pre-render the QR so "Show UPI QR" opens instantly.
  useEffect(() => {
    let cancelled = false;
    const u = profile?.user;
    if (!u?.upiId) {
      setQr(null);
      return;
    }
    QRCode.toDataURL(buildMyQrValue(u.upiId, u.name), { width: 640, margin: 2 })
      .then((url) => {
        if (!cancelled) setQr(url);
      })
      .catch(() => {
        if (!cancelled) setQr(null); // QR failed — modal falls back to the VPA text
      });
    return () => {
      cancelled = true;
    };
  }, [profile?.user?.upiId, profile?.user?.name, profile?.user]);

  const u = profile?.user;
  const net = balance?.netMinor ?? 0;

  return (
    <AppShell title={u?.name ?? 'Profile'} back="/friends">
      {loading ? (
        <SkeletonList rows={3} />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : profile && u ? (
        <div className="stack" style={{ gap: 14 }}>
          {/* Identity */}
          <div className="card card-pad" style={{ textAlign: 'center' }}>
            <div style={{ display: 'inline-block', margin: '6px 0 10px' }}>
              <Avatar name={u.name} size={76} color={u.avatarColor} />
            </div>
            <div style={{ fontWeight: 700, fontSize: 19 }}>{u.name}</div>
            {u.phone && (
              <div className="muted" style={{ fontSize: 14 }}>
                {u.phone}
              </div>
            )}
            {u.email && (
              <div className="faint" style={{ fontSize: 13 }}>
                {u.email}
              </div>
            )}
            <div style={{ marginTop: 8 }}>
              <span className="badge badge-primary">
                {profile.relationship === 'friends'
                  ? 'Friends'
                  : profile.relationship === 'request_sent'
                    ? 'Request sent'
                    : profile.relationship === 'request_received'
                      ? 'Sent you a request'
                      : 'Group member'}
              </span>
            </div>
            {u.upiId ? (
              <button
                className="btn btn-primary btn-block"
                style={{ marginTop: 16 }}
                onClick={() => setShowQr(true)}
              >
                Show UPI QR
              </button>
            ) : (
              <p className="faint" style={{ fontSize: 13, margin: '14px 0 0' }}>
                {u.name} hasn&apos;t added a UPI ID yet.
              </p>
            )}
          </div>

          {/* Balance with them */}
          {balance && net !== 0 && (
            <div className="card card-pad between">
              <div>
                <div className="section-title" style={{ marginBottom: 2 }}>
                  Between you two
                </div>
                <div className={`amount ${net > 0 ? 'pos' : 'neg'}`} style={{ fontSize: 20 }}>
                  {net > 0 ? `owes you ` : `you owe `}
                  {formatMoney(Math.abs(net), balance.currency)}
                </div>
              </div>
              {balance.groups[0] && (
                <a className="btn btn-ghost btn-sm" href={`/groups/${balance.groups[0].id}`}>
                  Settle in group
                </a>
              )}
            </div>
          )}

          {/* Mutual groups */}
          <div className="card card-pad">
            <div className="section-title">Mutual groups ({profile.mutualGroups.length})</div>
            {profile.mutualGroups.length === 0 ? (
              <p className="faint" style={{ fontSize: 13, margin: 0 }}>
                No groups together yet — add {u.name} to one from the group&apos;s People sheet.
              </p>
            ) : (
              <div className="stack" style={{ gap: 4 }}>
                {profile.mutualGroups.map((g) => (
                  <a
                    key={g.id}
                    href={`/groups/${g.id}`}
                    className="between"
                    style={{ color: 'inherit', textDecoration: 'none', padding: '8px 0' }}
                  >
                    <span className="row" style={{ gap: 10 }}>
                      <Avatar name={g.name} size={30} />
                      <span style={{ fontWeight: 600 }}>{g.name}</span>
                    </span>
                    <span className="faint" aria-hidden>
                      ›
                    </span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Full-screen UPI QR */}
      {showQr && u?.upiId && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`UPI QR for ${u.name}`}
          onClick={() => setShowQr(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 90,
            background: 'rgba(8, 10, 14, 0.92)',
            display: 'grid',
            placeItems: 'center',
            padding: 24,
          }}
        >
          <div style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 18, marginBottom: 4 }}>
              Pay {u.name}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 16 }}>
              Scan with GPay, PhonePe, Paytm, or any UPI app
            </div>
            {qr ? (
              <div
                style={{
                  display: 'inline-block',
                  padding: 16,
                  background: '#fff',
                  borderRadius: 20,
                }}
              >
                {/* Data-URL QR — next/image adds nothing for an inline data URI. */}
                <img
                  src={qr}
                  alt={`UPI QR encoding ${u.upiId}`}
                  style={{ display: 'block', width: 'min(78vw, 340px)', height: 'auto' }}
                />
              </div>
            ) : (
              <div
                style={{
                  padding: 24,
                  background: '#fff',
                  borderRadius: 20,
                  color: '#1a1c20',
                  fontWeight: 600,
                }}
              >
                QR unavailable — pay directly to:
                <div className="mono" style={{ marginTop: 8 }}>
                  {u.upiId}
                </div>
              </div>
            )}
            <div className="mono" style={{ color: 'rgba(255,255,255,0.85)', marginTop: 14 }}>
              {u.upiId}
            </div>
            <button
              className="btn btn-ghost"
              style={{ marginTop: 18, background: 'rgba(255,255,255,0.12)', color: '#fff' }}
              onClick={() => setShowQr(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
