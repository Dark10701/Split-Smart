'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';

export default function LoginPage() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [token, setToken] = useState('');

  const submit = (): void => {
    if (!token.trim()) return;
    signIn(token.trim());
    router.push('/groups');
  };

  return (
    <div className="app-frame">
      <main className="container" style={{ paddingTop: 64 }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginBottom: 24,
          }}
        >
          <span
            className="brand-mark"
            aria-hidden
            style={{ width: 56, height: 56, fontSize: 26, marginBottom: 12 }}
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
          <p className="muted" style={{ marginBottom: 18, fontSize: 14 }}>
            Production sign-in uses Google, Apple, or email via your OIDC provider. For this
            preview, paste a valid bearer token.
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
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="eyJhbGci…"
            />
          </div>
          <button className="btn btn-primary btn-block" disabled={!token.trim()} onClick={submit}>
            Continue
          </button>
        </div>
      </main>
    </div>
  );
}
