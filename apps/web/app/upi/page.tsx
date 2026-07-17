'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { useAuth } from '../../lib/auth';
import { api, ApiError, type Me } from '../../lib/api';
import { buildMyQrValue } from '../../lib/upi';
import {
  AppShell,
  Avatar,
  SkeletonList,
  ErrorState,
  Toast,
  type ToastState,
} from '../../components/ui';

/**
 * My UPI: the user's own payment QR (static — payer's app asks the amount),
 * with their UPI ID, name and mobile number, plus download/share actions.
 */
export default function MyUpiPage() {
  const { token, ready, signOut } = useAuth();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [upiInput, setUpiInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const profile = await api.me(token);
      setMe(profile);
      setUpiInput(profile.upiId ?? '');
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

  // Render the QR whenever the profile's VPA changes.
  useEffect(() => {
    let cancelled = false;
    if (!me?.upiId) {
      setQr(null);
      return;
    }
    QRCode.toDataURL(buildMyQrValue(me.upiId, me.name), { width: 480, margin: 2 })
      .then((url) => {
        if (!cancelled) setQr(url);
      })
      .catch(() => {
        if (!cancelled) setQr(null);
      });
    return () => {
      cancelled = true;
    };
  }, [me?.upiId, me?.name]);

  const saveUpi = async (): Promise<void> => {
    if (!token || !upiInput.trim()) return;
    setError(null);
    setSaving(true);
    try {
      setMe(await api.updateMe(token, { upiId: upiInput.trim() }));
      setToast({ message: 'UPI ID saved', kind: 'success' });
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 400
          ? 'That does not look like a valid UPI ID or UPI link'
          : 'Could not save your UPI ID',
      );
    } finally {
      setSaving(false);
    }
  };

  const downloadQr = (): void => {
    if (!qr || !me) return;
    const a = document.createElement('a');
    a.href = qr;
    a.download = `SplitSmart-UPI-${me.name.replace(/\s+/g, '-')}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setToast({ message: 'QR downloaded', kind: 'success' });
  };

  const shareQr = async (): Promise<void> => {
    if (!qr || !me?.upiId) return;
    const text = `Pay ${me.name} on UPI: ${me.upiId}`;
    try {
      const blob = await (await fetch(qr)).blob();
      const file = new File([blob], 'upi-qr.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: 'My UPI QR', text, files: [file] });
        return;
      }
      if (navigator.share) {
        await navigator.share({ title: 'My UPI', text });
        return;
      }
      throw new Error('no share');
    } catch (e) {
      if ((e as Error).name === 'AbortError') return; // user closed the sheet
      try {
        await navigator.clipboard.writeText(text);
        setToast({ message: 'Copied — sharing not available here', kind: 'success' });
      } catch {
        setToast({ message: 'Could not share on this device', kind: 'error' });
      }
    }
  };

  return (
    <AppShell title="My UPI" back="/groups">
      {loading ? (
        <SkeletonList rows={3} />
      ) : loadError ? (
        <ErrorState message="Could not load your UPI details" onRetry={() => void load()} />
      ) : me ? (
        <div className="stack" style={{ gap: 14 }}>
          {me.upiId && qr ? (
            <div className="card card-pad" style={{ textAlign: 'center' }}>
              <div className="row" style={{ justifyContent: 'center', gap: 10, marginBottom: 6 }}>
                <Avatar name={me.name} size={34} color={me.avatarColor} />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 700 }}>{me.name}</div>
                  {me.phone && (
                    <div className="faint" style={{ fontSize: 12 }}>
                      {me.phone}
                    </div>
                  )}
                </div>
              </div>
              <div
                style={{
                  display: 'inline-block',
                  padding: 12,
                  background: '#fff',
                  borderRadius: 16,
                  marginTop: 6,
                }}
              >
                {/* Data-URL QR — next/image adds nothing for an inline data URI. */}
                <img
                  src={qr}
                  width={224}
                  height={224}
                  alt={`UPI QR for ${me.upiId}`}
                  style={{ display: 'block' }}
                />
              </div>
              <div className="mono" style={{ fontSize: 14, marginTop: 10, color: 'var(--muted)' }}>
                {me.upiId}
              </div>
              <p className="faint" style={{ fontSize: 12, margin: '6px 0 14px' }}>
                Anyone can scan this with GPay, PhonePe, Paytm, or any UPI app — they enter the
                amount.
              </p>
              <div className="row">
                <button className="btn btn-primary btn-block" onClick={downloadQr}>
                  ⬇ Download QR
                </button>
                <button className="btn btn-ghost btn-block" onClick={() => void shareQr()}>
                  Share
                </button>
              </div>
            </div>
          ) : (
            <div className="card empty">
              <div className="empty-emoji">📲</div>
              <div style={{ fontWeight: 600, color: 'var(--text)' }}>No UPI ID yet</div>
              <div>Add your UPI ID to get a shareable payment QR.</div>
            </div>
          )}

          <div className="card card-pad">
            <div className="section-title">{me.upiId ? 'Change UPI ID' : 'Add your UPI ID'}</div>
            <div className="row">
              <input
                className="input"
                value={upiInput}
                onChange={(e) => setUpiInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void saveUpi()}
                autoCapitalize="none"
                spellCheck={false}
                placeholder="yourname@bank  or paste a UPI link"
              />
              <button
                className="btn btn-primary"
                onClick={() => void saveUpi()}
                disabled={saving || !upiInput.trim() || upiInput.trim() === (me.upiId ?? '')}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
            {error && (
              <p className="error" style={{ marginBottom: 0 }}>
                {error}
              </p>
            )}
            <p className="faint" style={{ fontSize: 12, margin: '8px 0 0' }}>
              Group members use this to pay you. You can also edit it from your profile.
            </p>
          </div>
        </div>
      ) : null}
      <Toast toast={toast} onDone={() => setToast(null)} />
    </AppShell>
  );
}
