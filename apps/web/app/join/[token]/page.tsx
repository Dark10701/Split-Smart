'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth';
import { api, ApiError } from '../../../lib/api';
import { AppBar } from '../../../components/ui';

export default function JoinPage() {
  const { token, ready } = useAuth();
  const router = useRouter();
  const inviteToken = useParams<{ token: string }>().token;
  const [status, setStatus] = useState<'joining' | 'done' | 'error'>('joining');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!ready) return;
    if (!token) {
      router.push('/login');
      return;
    }
    void (async () => {
      try {
        await api.joinGroup(token, inviteToken);
        setStatus('done');
        setTimeout(() => router.push('/groups'), 900);
      } catch (e) {
        setStatus('error');
        setMessage(
          e instanceof ApiError && e.status === 400
            ? 'This invite is invalid or has expired.'
            : e instanceof ApiError && e.status === 409
              ? 'You are already a member of this group.'
              : 'Could not join the group.',
        );
      }
    })();
  }, [ready, token, inviteToken, router]);

  return (
    <>
      <AppBar />
      <main className="container" style={{ maxWidth: 460 }}>
        <div className="card empty">
          {status === 'joining' && <div>Joining group…</div>}
          {status === 'done' && (
            <>
              <div className="empty-emoji">✅</div>
              <div>You&apos;re in! Redirecting…</div>
            </>
          )}
          {status === 'error' && (
            <>
              <div className="empty-emoji">😕</div>
              <div style={{ color: 'var(--text)', fontWeight: 600 }}>{message}</div>
              <a href="/groups" className="btn btn-ghost btn-sm" style={{ marginTop: 12 }}>
                Go to your groups
              </a>
            </>
          )}
        </div>
      </main>
    </>
  );
}
