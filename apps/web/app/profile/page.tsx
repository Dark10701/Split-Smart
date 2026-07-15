'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { api, ApiError, type Me } from '../../lib/api';
import { AppShell, Avatar, SkeletonList, ErrorState, ThemeToggle } from '../../components/ui';

export default function ProfilePage() {
  const { token, ready, signOut } = useAuth();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [name, setName] = useState('');
  const [upi, setUpi] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const profile = await api.me(token);
      setMe(profile);
      setName(profile.name);
      setUpi(profile.upiId ?? '');
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
    void load();
  }, [load]);

  const save = async (): Promise<void> => {
    setError(null);
    setMsg(null);
    if (!token || !me) return;
    const body: { name?: string; upiId?: string | null } = {};
    if (name.trim() && name.trim() !== me.name) body.name = name.trim();
    const u = upi.trim();
    if (u !== (me.upiId ?? '')) body.upiId = u === '' ? null : u;
    if (Object.keys(body).length === 0) {
      setMsg('Nothing to save');
      return;
    }
    setSaving(true);
    try {
      const updated = await api.updateMe(token, body);
      setMe(updated);
      setUpi(updated.upiId ?? '');
      setMsg(
        body.upiId === null
          ? 'UPI ID removed'
          : updated.upiId
            ? `Saved — group members can now pay you at ${updated.upiId}`
            : 'Saved',
      );
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 400
          ? 'That does not look like a valid UPI ID or UPI link'
          : 'Could not save your profile',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell title="Profile" active="profile">
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>Your profile</h1>

      {loading ? (
        <SkeletonList rows={3} />
      ) : loadError ? (
        <ErrorState message="Could not load your profile" onRetry={() => void load()} />
      ) : me ? (
        <div className="card card-pad">
          <div
            className="row"
            style={{ gap: 14, marginBottom: 20, flexDirection: 'column', textAlign: 'center' }}
          >
            <Avatar name={me.name} size={72} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 19 }}>{me.name}</div>
              <div className="muted" style={{ fontSize: 14 }}>
                {me.email}
              </div>
            </div>
          </div>

          <div className="field">
            <label className="label" htmlFor="name">
              Name
            </label>
            <input
              id="name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="upi">
              UPI ID
            </label>
            <input
              id="upi"
              className="input"
              value={upi}
              onChange={(e) => setUpi(e.target.value)}
              autoCapitalize="none"
              spellCheck={false}
              placeholder="yourname@bank  or  upi://pay?pa=…"
            />
            <p className="faint" style={{ fontSize: 13, margin: '7px 0 0' }}>
              Type your UPI ID, or paste a UPI payment link / your UPI QR&apos;s contents. Members
              use this to pay you directly. Leave blank to remove.
            </p>
          </div>

          {error && <p className="error">{error}</p>}
          {msg && <p className="success-text">{msg}</p>}
          <button
            className="btn btn-primary btn-block"
            onClick={() => void save()}
            disabled={saving}
            style={{ marginTop: 6 }}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>

          <hr className="divider" />
          <div className="between">
            <div>
              <div style={{ fontWeight: 600 }}>Dark mode</div>
              <div className="faint" style={{ fontSize: 13 }}>
                Switch between the dark and light theme
              </div>
            </div>
            <ThemeToggle />
          </div>
          <button className="btn btn-ghost btn-block" onClick={signOut} style={{ marginTop: 16 }}>
            Sign out
          </button>
        </div>
      ) : null}
    </AppShell>
  );
}
