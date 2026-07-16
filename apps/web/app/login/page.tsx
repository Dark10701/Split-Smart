'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';

const DEV_AUTH_URL = process.env.NEXT_PUBLIC_DEV_AUTH_URL ?? 'http://localhost:3999';

interface DevUser {
  sub: string;
  name: string;
  email: string;
}

export default function LoginPage() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [token, setToken] = useState('');
  const [devUsers, setDevUsers] = useState<DevUser[]>([]);
  const [devError, setDevError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Offer one-click sign-in if the local dev auth issuer is reachable.
  useEffect(() => {
    let cancelled = false;
    fetch(`${DEV_AUTH_URL}/token`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((users: DevUser[]) => {
        if (!cancelled) setDevUsers(users);
      })
      .catch(() => {
        /* issuer not running — the manual token box still works */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = (): void => {
    if (!token.trim()) return;
    signIn(token.trim());
    router.push('/groups');
  };

  const signInAs = async (user: DevUser): Promise<void> => {
    setDevError(null);
    setBusy(user.sub);
    try {
      const res = await fetch(`${DEV_AUTH_URL}/token?user=${encodeURIComponent(user.sub)}`);
      if (!res.ok) throw new Error();
      const { token: t } = (await res.json()) as { token: string };
      signIn(t);
      router.push('/groups');
    } catch {
      setDevError('Could not reach the dev auth issuer. Is `pnpm --filter @splitsmart/api dev:auth` running?');
      setBusy(null);
    }
  };

  return (
    <div className="app-frame">
      <main className="container" style={{ paddingTop: 24 }}>
        <a href="/" className="faint" style={{ fontSize: 14 }}>
          ← Back
        </a>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            margin: '40px 0 24px',
          }}
        >
          <span
            className="brand-mark"
            aria-hidden
            style={{ width: 64, height: 64, fontSize: 30, marginBottom: 14 }}
          >
            S
          </span>
          <div style={{ fontWeight: 700, fontSize: 22 }}>SplitSmart</div>
          <div className="muted" style={{ fontSize: 14 }}>
            Split expenses, settle over UPI
          </div>
        </div>

        <div className="card card-pad">
          <h1 style={{ fontSize: 20, marginBottom: 6 }}>Sign in</h1>

          {devUsers.length > 0 ? (
            <>
              <p className="muted" style={{ marginBottom: 16, fontSize: 14 }}>
                Local dev — pick a demo account to sign in instantly.
              </p>
              <div className="stack" style={{ gap: 10 }}>
                {devUsers.map((u) => (
                  <button
                    key={u.sub}
                    className="btn btn-primary btn-block"
                    disabled={busy !== null}
                    onClick={() => void signInAs(u)}
                  >
                    {busy === u.sub ? 'Signing in…' : `Continue as ${u.name}`}
                  </button>
                ))}
              </div>
              {devError && (
                <p className="error" style={{ marginTop: 12 }}>
                  {devError}
                </p>
              )}
              <div className="divider" />
              <p className="faint" style={{ fontSize: 13, marginBottom: 10 }}>
                Or paste a bearer token manually:
              </p>
            </>
          ) : (
            <p className="muted" style={{ marginBottom: 18, fontSize: 14 }}>
              Production sign-in uses Google, Apple, or email via your OIDC provider. For this
              preview, paste a valid bearer token (or run the dev auth issuer for one-click sign-in).
            </p>
          )}

          <div className="field">
            <label className="label" htmlFor="token">
              Bearer token
            </label>
            <input
              id="token"
              className="input"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="eyJhbGci…"
            />
          </div>
          <button
            className="btn btn-ghost btn-block"
            disabled={!token.trim()}
            onClick={submit}
          >
            Continue with token
          </button>
        </div>
      </main>
    </div>
  );
}
