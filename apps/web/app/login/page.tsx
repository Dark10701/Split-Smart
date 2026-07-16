'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { BrandMark } from '../../components/BrandMark';

const DEV_AUTH_URL = process.env.NEXT_PUBLIC_DEV_AUTH_URL ?? 'http://localhost:3999';

interface DevUser {
  sub: string;
  name: string;
  email: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const { signIn } = useAuth();
  const router = useRouter();

  const [issuerUp, setIssuerUp] = useState(false);
  const [devUsers, setDevUsers] = useState<DevUser[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The email form needs the local issuer; probe it once.
  useEffect(() => {
    let cancelled = false;
    fetch(`${DEV_AUTH_URL}/token`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((users: DevUser[]) => {
        if (cancelled) return;
        setIssuerUp(true);
        setDevUsers(users);
      })
      .catch(() => {
        /* issuer not running — manual token entry still works */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const finish = (t: string): void => {
    signIn(t);
    router.push('/groups');
  };

  const submitEmail = async (): Promise<void> => {
    setError(null);
    if (!EMAIL_RE.test(email.trim())) {
      setError('Enter a valid email address');
      return;
    }
    setBusy(true);
    try {
      const params = new URLSearchParams({ email: email.trim() });
      if (name.trim()) params.set('name', name.trim());
      const res = await fetch(`${DEV_AUTH_URL}/token?${params}`);
      if (!res.ok) throw new Error();
      const { token: t } = (await res.json()) as { token: string };
      finish(t);
    } catch {
      setError('Could not sign you in. Is the dev auth issuer running?');
      setBusy(false);
    }
  };

  const signInAs = async (user: DevUser): Promise<void> => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${DEV_AUTH_URL}/token?user=${encodeURIComponent(user.sub)}`);
      if (!res.ok) throw new Error();
      const { token: t } = (await res.json()) as { token: string };
      finish(t);
    } catch {
      setError('Could not reach the dev auth issuer.');
      setBusy(false);
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
            margin: '36px 0 22px',
          }}
        >
          <BrandMark style={{ width: 64, height: 64, marginBottom: 14 }} />
          <div style={{ fontWeight: 700, fontSize: 22 }}>SplitSmart</div>
          <div className="muted" style={{ fontSize: 14 }}>
            Split expenses, settle over UPI
          </div>
        </div>

        <div className="card card-pad">
          {issuerUp ? (
            <>
              <h1 style={{ fontSize: 20, marginBottom: 4 }}>Sign in or create your account</h1>
              <p className="muted" style={{ margin: '0 0 16px', fontSize: 14 }}>
                Enter your email — we&apos;ll create your account the first time.
              </p>
              <div className="field">
                <label className="label" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  className="input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void submitEmail()}
                  placeholder="you@example.com"
                  autoComplete="email"
                  autoFocus
                />
              </div>
              <div className="field">
                <label className="label" htmlFor="name">
                  Your name{' '}
                  <span className="faint" style={{ fontWeight: 400 }}>
                    (shown to group members)
                  </span>
                </label>
                <input
                  id="name"
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void submitEmail()}
                  placeholder="e.g. Aditya"
                  autoComplete="name"
                />
              </div>
              {error && <p className="error">{error}</p>}
              <button
                className="btn btn-primary btn-block"
                onClick={() => void submitEmail()}
                disabled={busy || !email.trim()}
              >
                {busy ? 'Signing in…' : 'Continue'}
              </button>

              {devUsers.length > 0 && (
                <>
                  <div className="divider" />
                  <p className="faint" style={{ fontSize: 13, margin: '0 0 10px' }}>
                    Or use a demo account:
                  </p>
                  <div className="row">
                    {devUsers.map((u) => (
                      <button
                        key={u.sub}
                        className="btn btn-ghost btn-sm"
                        style={{ flex: 1 }}
                        disabled={busy}
                        onClick={() => void signInAs(u)}
                      >
                        {u.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <h1 style={{ fontSize: 20, marginBottom: 6 }}>Sign in</h1>
              <p className="muted" style={{ marginBottom: 18, fontSize: 14 }}>
                Production sign-in uses Google, Apple, or email via your OIDC provider. For local
                use, start the dev auth issuer (<code className="mono">dev:auth</code>) for email
                sign-in, or paste a bearer token below.
              </p>
              <div className="field">
                <label className="label" htmlFor="token">
                  Bearer token
                </label>
                <input
                  id="token"
                  className="input"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && token.trim() && finish(token.trim())}
                  placeholder="eyJhbGci…"
                />
              </div>
              {error && <p className="error">{error}</p>}
              <button
                className="btn btn-primary btn-block"
                disabled={!token.trim()}
                onClick={() => finish(token.trim())}
              >
                Continue with token
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
