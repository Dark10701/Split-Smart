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
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
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

  /** Step 1: request a verification code for this email. */
  const requestCode = async (): Promise<void> => {
    setError(null);
    if (!EMAIL_RE.test(email.trim())) {
      setError('Enter a valid email address');
      return;
    }
    setBusy(true);
    try {
      const params = new URLSearchParams({ email: email.trim() });
      if (name.trim()) params.set('name', name.trim());
      const res = await fetch(`${DEV_AUTH_URL}/otp/request?${params}`);
      if (!res.ok) throw new Error();
      const body = (await res.json()) as { devCode?: string };
      setDevCode(body.devCode ?? null);
      setCode('');
      setStep('code');
    } catch {
      setError('Could not send the code. Is the dev auth issuer running?');
    } finally {
      setBusy(false);
    }
  };

  /** Step 2: exchange email + code for a token. */
  const verifyCode = async (): Promise<void> => {
    setError(null);
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Enter the 6-digit code');
      return;
    }
    setBusy(true);
    try {
      const params = new URLSearchParams({ email: email.trim(), code: code.trim() });
      if (name.trim()) params.set('name', name.trim());
      const res = await fetch(`${DEV_AUTH_URL}/token?${params}`);
      const body = (await res.json()) as { token?: string; error?: string };
      if (!res.ok || !body.token) {
        setError(body.error ?? 'Verification failed — try again.');
        setBusy(false);
        return;
      }
      finish(body.token);
    } catch {
      setError('Could not verify the code. Is the dev auth issuer running?');
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
          {issuerUp && step === 'email' && (
            <>
              <h1 style={{ fontSize: 20, marginBottom: 4 }}>Sign in or create your account</h1>
              <p className="muted" style={{ margin: '0 0 16px', fontSize: 14 }}>
                We&apos;ll email you a 6-digit code to verify it&apos;s you.
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
                  onKeyDown={(e) => e.key === 'Enter' && void requestCode()}
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
                  onKeyDown={(e) => e.key === 'Enter' && void requestCode()}
                  placeholder="e.g. Aditya"
                  autoComplete="name"
                />
              </div>
              {error && <p className="error">{error}</p>}
              <button
                className="btn btn-primary btn-block"
                onClick={() => void requestCode()}
                disabled={busy || !email.trim()}
              >
                {busy ? 'Sending code…' : 'Send verification code'}
              </button>

              {devUsers.length > 0 && (
                <>
                  <div className="divider" />
                  <p className="faint" style={{ fontSize: 13, margin: '0 0 10px' }}>
                    Or use a demo account (pre-verified):
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
          )}

          {issuerUp && step === 'code' && (
            <>
              <h1 style={{ fontSize: 20, marginBottom: 4 }}>Check your email</h1>
              <p className="muted" style={{ margin: '0 0 16px', fontSize: 14 }}>
                We sent a 6-digit code to <strong>{email.trim()}</strong>. Enter it below to verify
                your account.
              </p>
              <div className="field">
                <label className="label" htmlFor="code">
                  Verification code
                </label>
                <input
                  id="code"
                  className="input"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && void verifyCode()}
                  placeholder="123456"
                  autoComplete="one-time-code"
                  autoFocus
                  style={{ letterSpacing: '0.35em', textAlign: 'center', fontSize: 20 }}
                />
              </div>
              {devCode && (
                <p className="faint" style={{ fontSize: 12, marginTop: 0 }}>
                  Local dev has no mail server — your code is <strong>{devCode}</strong> (also
                  printed in the issuer terminal). Real deployments email it instead.
                </p>
              )}
              {error && <p className="error">{error}</p>}
              <button
                className="btn btn-primary btn-block"
                onClick={() => void verifyCode()}
                disabled={busy || code.trim().length !== 6}
              >
                {busy ? 'Verifying…' : 'Verify & sign in'}
              </button>
              <div className="between" style={{ marginTop: 12 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setStep('email');
                    setError(null);
                  }}
                >
                  ← Different email
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={busy}
                  onClick={() => void requestCode()}
                >
                  Resend code
                </button>
              </div>
            </>
          )}

          {!issuerUp && (
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
