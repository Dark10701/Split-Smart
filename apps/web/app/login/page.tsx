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
    <main className="container" style={{ maxWidth: 440, paddingTop: 72 }}>
      <a href="/" className="brand" style={{ marginBottom: 28, display: 'inline-flex' }}>
        <span className="brand-mark">S</span>
        SplitSmart
      </a>
      <div className="card card-pad">
        <h1 style={{ fontSize: 24, marginBottom: 6 }}>Sign in</h1>
        <p className="muted" style={{ marginBottom: 18, fontSize: 14 }}>
          Production sign-in uses Google, Apple, or email via your OIDC provider. For this preview,
          paste a valid bearer token.
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
  );
}
