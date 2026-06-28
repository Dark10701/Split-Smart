'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';

export default function LoginPage() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [token, setToken] = useState('');

  return (
    <main style={{ maxWidth: 480, margin: '64px auto', padding: 16 }}>
      <h1>Sign in</h1>
      <p style={{ color: '#6B7280' }}>
        Production builds sign in with Google/Apple/email via your OIDC provider. For now, paste a
        valid bearer token.
      </p>
      <input
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="Bearer token"
        style={{ width: '100%', padding: 10, marginBottom: 12 }}
      />
      <button
        disabled={!token}
        onClick={() => {
          signIn(token.trim());
          router.push('/groups');
        }}
        style={{ padding: '10px 16px' }}
      >
        Continue
      </button>
    </main>
  );
}
