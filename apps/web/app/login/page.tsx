'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { BrandMark } from '../../components/BrandMark';
import { Scene } from '../../components/Scene';

const DEV_AUTH_URL = process.env.NEXT_PUBLIC_DEV_AUTH_URL ?? 'http://localhost:3999';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Mode = 'signin' | 'register' | 'register-code';

export default function LoginPage() {
  const { signIn } = useAuth();
  const router = useRouter();

  const [issuerUp, setIssuerUp] = useState(false);
  const [mode, setMode] = useState<Mode>('signin');

  // Sign-in fields
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // Registration fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [upiId, setUpiId] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);

  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${DEV_AUTH_URL}/health`)
      .then((r) => {
        if (r.ok && !cancelled) setIssuerUp(true);
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

  const post = async (path: string, body: unknown): Promise<Record<string, unknown>> => {
    const res = await fetch(`${DEV_AUTH_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Request failed');
    return data;
  };

  /** Email OR mobile number + password. */
  const submitSignIn = async (): Promise<void> => {
    setError(null);
    if (!identifier.trim() || !password) {
      setError('Enter your email or mobile number, and your password');
      return;
    }
    setBusy(true);
    try {
      const { token: t } = await post('/login', { identifier: identifier.trim(), password });
      finish(t as string);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  /** Step 1 of registration: validate locally, then email the code. */
  const startRegister = async (): Promise<void> => {
    setError(null);
    if (!name.trim()) return setError('Enter your full name');
    if (!EMAIL_RE.test(email.trim())) return setError('Enter a valid email address');
    if (!/^(?:\+?91|0)?[\s-]*[6-9][\d\s-]{9,14}$/.test(phone.trim()))
      return setError('Enter a valid Indian mobile number');
    if (regPassword.length < 8) return setError('Password must be at least 8 characters');
    setBusy(true);
    try {
      const params = new URLSearchParams({ email: email.trim(), name: name.trim() });
      const res = await fetch(`${DEV_AUTH_URL}/otp/request?${params}`);
      if (!res.ok) throw new Error('Could not send the verification code');
      const body = (await res.json()) as { devCode?: string };
      setDevCode(body.devCode ?? null);
      setCode('');
      setMode('register-code');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  /** Step 2: code + full details → account created + signed in. */
  const completeRegister = async (): Promise<void> => {
    setError(null);
    if (!/^\d{6}$/.test(code.trim())) return setError('Enter the 6-digit code');
    setBusy(true);
    try {
      const { token: t } = await post('/register', {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password: regPassword,
        upiId: upiId.trim() || undefined,
        code: code.trim(),
      });
      finish(t as string);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const field = (
    id: string,
    label: string,
    value: string,
    set: (v: string) => void,
    props: Record<string, unknown> = {},
  ) => (
    <div className="field">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="input"
        value={value}
        onChange={(e) => set((e.target as HTMLInputElement).value)}
        {...props}
      />
    </div>
  );

  return (
    <div className="app-frame">
      <main className="container" style={{ paddingTop: 40 }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            margin: '10px 0 20px',
          }}
        >
          <BrandMark style={{ width: 60, height: 60, marginBottom: 12 }} />
          <div style={{ fontWeight: 700, fontSize: 22 }}>SplitSmart</div>
          <div className="muted" style={{ fontSize: 14 }}>
            Split expenses, settle over UPI
          </div>
        </div>

        <div className="card card-pad">
          {!issuerUp ? (
            <>
              <h1 style={{ fontSize: 20, marginBottom: 6 }}>Sign in</h1>
              <p className="muted" style={{ marginBottom: 18, fontSize: 14 }}>
                Production sign-in uses your OIDC provider. For local use, start the dev auth issuer
                (<code className="mono">pnpm start</code>), or paste a bearer token below.
              </p>
              {field('token', 'Bearer token', token, setToken, { placeholder: 'eyJhbGci…' })}
              {error && <p className="error">{error}</p>}
              <button
                className="btn btn-primary btn-block"
                disabled={!token.trim()}
                onClick={() => finish(token.trim())}
              >
                Continue with token
              </button>
            </>
          ) : mode === 'signin' ? (
            <>
              <div className="tabs" style={{ marginBottom: 16 }}>
                <button className="tab active">Sign in</button>
                <button className="tab" onClick={() => setMode('register')}>
                  Create account
                </button>
              </div>
              {field('identifier', 'Email or mobile number', identifier, setIdentifier, {
                placeholder: 'you@example.com or 98765 43210',
                autoComplete: 'username',
                autoFocus: true,
                onKeyDown: (e: React.KeyboardEvent) => e.key === 'Enter' && void submitSignIn(),
              })}
              {field('password', 'Password', password, setPassword, {
                type: 'password',
                autoComplete: 'current-password',
                placeholder: '••••••••',
                onKeyDown: (e: React.KeyboardEvent) => e.key === 'Enter' && void submitSignIn(),
              })}
              {error && <p className="error">{error}</p>}
              <button
                className="btn btn-primary btn-block"
                onClick={() => void submitSignIn()}
                disabled={busy || !identifier.trim() || !password}
              >
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
            </>
          ) : mode === 'register' ? (
            <>
              <div className="tabs" style={{ marginBottom: 16 }}>
                <button className="tab" onClick={() => setMode('signin')}>
                  Sign in
                </button>
                <button className="tab active">Create account</button>
              </div>
              {field('name', 'Full name', name, setName, {
                placeholder: 'e.g. Aditya Patil',
                autoComplete: 'name',
                autoFocus: true,
              })}
              {field('email', 'Email', email, setEmail, {
                type: 'email',
                placeholder: 'you@example.com',
                autoComplete: 'email',
              })}
              {field('phone', 'Mobile number', phone, setPhone, {
                inputMode: 'tel',
                placeholder: '98765 43210',
                autoComplete: 'tel',
              })}
              {field('reg-password', 'Password', regPassword, setRegPassword, {
                type: 'password',
                autoComplete: 'new-password',
                placeholder: 'At least 8 characters',
              })}
              {field('upi', 'UPI ID (optional, recommended)', upiId, setUpiId, {
                placeholder: 'yourname@bank',
                autoCapitalize: 'none',
                spellCheck: false,
              })}
              {error && <p className="error">{error}</p>}
              <button
                className="btn btn-primary btn-block"
                onClick={() => void startRegister()}
                disabled={busy}
              >
                {busy ? 'Sending code…' : 'Continue — verify email'}
              </button>
            </>
          ) : (
            <>
              <h1 style={{ fontSize: 20, marginBottom: 4 }}>Check your email</h1>
              <p className="muted" style={{ margin: '0 0 16px', fontSize: 14 }}>
                We sent a 6-digit code to <strong>{email.trim()}</strong>.
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
                  onKeyDown={(e) => e.key === 'Enter' && void completeRegister()}
                  placeholder="123456"
                  autoComplete="one-time-code"
                  autoFocus
                  style={{ letterSpacing: '0.35em', textAlign: 'center', fontSize: 20 }}
                />
              </div>
              {devCode && (
                <p className="faint" style={{ fontSize: 12, marginTop: 0 }}>
                  Local dev has no mail server — your code is <strong>{devCode}</strong>. Real
                  deployments email it.
                </p>
              )}
              {error && <p className="error">{error}</p>}
              <button
                className="btn btn-primary btn-block"
                onClick={() => void completeRegister()}
                disabled={busy || code.trim().length !== 6}
              >
                {busy ? 'Creating account…' : 'Verify & create account'}
              </button>
              <div className="between" style={{ marginTop: 12 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setMode('register')}>
                  ← Edit details
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={busy}
                  onClick={() => void startRegister()}
                >
                  Resend code
                </button>
              </div>
            </>
          )}
        </div>

        <div style={{ marginTop: 24 }}>
          <Scene />
        </div>
      </main>
    </div>
  );
}
