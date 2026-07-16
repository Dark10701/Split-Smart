'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { api, ApiError, AVATAR_COLORS, type Me, type NotificationPref } from '../../lib/api';
import { AppShell, Avatar, SkeletonList, ErrorState, ThemeToggle } from '../../components/ui';

const PREF_TYPES: Array<{ type: NotificationPref['type']; label: string; hint: string }> = [
  { type: 'expense_added', label: 'Expense added', hint: 'Someone adds an expense in your group' },
  { type: 'settle_up', label: 'Settle-up requests', hint: 'Someone asks you to settle a balance' },
  {
    type: 'payment_confirmed',
    label: 'Payment recorded',
    hint: 'A payment involving you is recorded',
  },
  { type: 'reminder', label: 'Reminders', hint: 'Nudges about balances left unsettled' },
];

/** Small on/off switch reusing the theme-toggle styling. */
function Switch({
  on,
  onChange,
  label,
  disabled,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className="switch"
      data-on={on ? 'true' : 'false'}
      disabled={disabled}
      style={disabled ? { opacity: 0.5 } : undefined}
      onClick={() => onChange(!on)}
    />
  );
}

export default function ProfilePage() {
  const { token, ready, signOut } = useAuth();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [prefs, setPrefs] = useState<NotificationPref[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [name, setName] = useState('');
  const [upi, setUpi] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [prefError, setPrefError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [profile, notifPrefs] = await Promise.all([
        api.me(token),
        api.listNotificationPrefs(token),
      ]);
      setMe(profile);
      setPrefs(notifPrefs);
      setName(profile.name);
      setUpi(profile.upiId ?? '');
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

  /** Picking a swatch saves immediately; picking the active one resets to auto. */
  const pickColor = async (color: string): Promise<void> => {
    if (!token || !me) return;
    const next = me.avatarColor === color ? null : color;
    const prev = me;
    setMe({ ...me, avatarColor: next }); // optimistic
    try {
      setMe(await api.updateMe(token, { avatarColor: next }));
    } catch {
      setMe(prev);
      setError('Could not save your avatar color');
    }
  };

  /** Toggles save immediately (optimistically, reverting on failure). */
  const togglePref = async (
    type: NotificationPref['type'],
    channel: NotificationPref['channel'],
    enabled: boolean,
  ): Promise<void> => {
    if (!token) return;
    setPrefError(null);
    const prev = prefs;
    setPrefs((p) =>
      p.map((x) => (x.type === type && x.channel === channel ? { ...x, enabled } : x)),
    );
    try {
      setPrefs(await api.updateNotificationPrefs(token, [{ type, channel, enabled }]));
    } catch {
      setPrefs(prev);
      setPrefError('Could not save that preference — try again');
    }
  };

  const pref = (type: NotificationPref['type'], channel: NotificationPref['channel']): boolean =>
    prefs.find((p) => p.type === type && p.channel === channel)?.enabled ?? true;

  return (
    <AppShell title="Profile" active="profile">
      {loading ? (
        <SkeletonList rows={4} />
      ) : loadError ? (
        <ErrorState message="Could not load your profile" onRetry={() => void load()} />
      ) : me ? (
        <div className="stack" style={{ gap: 14 }}>
          {/* ---- Identity ---- */}
          <div className="card card-pad" style={{ textAlign: 'center' }}>
            <div style={{ display: 'inline-block', margin: '6px 0 10px' }}>
              <Avatar name={me.name} size={76} color={me.avatarColor} />
            </div>
            <div style={{ fontWeight: 700, fontSize: 19 }}>{me.name}</div>
            <div className="muted" style={{ fontSize: 14, marginBottom: 14 }}>
              {me.email}
            </div>

            <div className="section-title" style={{ textAlign: 'left' }}>
              Avatar color
            </div>
            <div
              className="row"
              style={{ justifyContent: 'flex-start', flexWrap: 'wrap', gap: 10 }}
            >
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  aria-label={`Avatar color ${c}${me.avatarColor === c ? ' (selected — tap to reset)' : ''}`}
                  aria-pressed={me.avatarColor === c}
                  onClick={() => void pickColor(c)}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    background: c,
                    cursor: 'pointer',
                    border:
                      me.avatarColor === c ? '3px solid var(--text)' : '3px solid transparent',
                  }}
                />
              ))}
            </div>
            <p className="faint" style={{ fontSize: 12, textAlign: 'left', margin: '8px 0 0' }}>
              Shown next to your name in every group. Tap the selected color again for automatic.
            </p>
          </div>

          {/* ---- Account ---- */}
          <div className="card card-pad">
            <div className="section-title">Account</div>
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
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>

          {/* ---- Notifications ---- */}
          <div className="card card-pad">
            <div className="between" style={{ marginBottom: 10 }}>
              <div className="section-title" style={{ marginBottom: 0 }}>
                Notifications
              </div>
              <div className="row" style={{ gap: 18 }}>
                <span className="faint" style={{ fontSize: 11, fontWeight: 700 }}>
                  PUSH
                </span>
                <span className="faint" style={{ fontSize: 11, fontWeight: 700 }}>
                  EMAIL
                </span>
              </div>
            </div>
            {PREF_TYPES.map(({ type, label, hint }) => (
              <div key={type} className="list-item">
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{label}</div>
                  <div className="faint" style={{ fontSize: 12 }}>
                    {hint}
                  </div>
                </div>
                <div className="row" style={{ gap: 12, flexShrink: 0 }}>
                  <Switch
                    on={pref(type, 'push')}
                    onChange={(v) => void togglePref(type, 'push', v)}
                    label={`${label} push notifications`}
                  />
                  <Switch
                    on={pref(type, 'email')}
                    onChange={(v) => void togglePref(type, 'email', v)}
                    label={`${label} email notifications`}
                  />
                </div>
              </div>
            ))}
            {prefError && (
              <p className="error" style={{ marginBottom: 0 }}>
                {prefError}
              </p>
            )}
          </div>

          {/* ---- Appearance + session ---- */}
          <div className="card card-pad">
            <div className="between">
              <div>
                <div style={{ fontWeight: 600 }}>Dark mode</div>
                <div className="faint" style={{ fontSize: 13 }}>
                  Switch between the dark and light theme
                </div>
              </div>
              <ThemeToggle />
            </div>
            <hr className="divider" />
            <button className="btn btn-ghost btn-block" onClick={signOut}>
              Sign out
            </button>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
