'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth';
import { api, ApiError, type InvitePreview } from '../../../lib/api';
import { AppShell, SkeletonList } from '../../../components/ui';

/**
 * Join-by-invite screen: shows what the link points at (group name + size)
 * and joins on a single tap. Signed-out users are sent to login with a
 * `next` target so they come straight back here afterwards.
 */
export default function JoinPage() {
  const { token, ready } = useAuth();
  const router = useRouter();
  const inviteToken = useParams<{ token: string }>().token;

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'idle' | 'joining' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setPreview(await api.invitePreview(token, inviteToken));
      setStatus('idle');
    } catch (e) {
      setStatus('error');
      setMessage(
        e instanceof ApiError && e.status === 400
          ? 'This invite link is invalid or has expired.'
          : 'Could not load this invite. Check your connection and try again.',
      );
    } finally {
      setLoading(false);
    }
  }, [token, inviteToken]);

  useEffect(() => {
    if (!ready) return;
    if (!token) {
      // Come back to this invite after signing in / creating an account.
      router.push(`/login?next=${encodeURIComponent(`/join/${inviteToken}`)}`);
      return;
    }
    void load();
  }, [ready, token, inviteToken, router, load]);

  const join = async (): Promise<void> => {
    if (!token) return;
    setStatus('joining');
    try {
      await api.joinGroup(token, inviteToken);
      setStatus('done');
      setTimeout(() => router.push(`/groups/${preview?.groupId ?? ''}`), 800);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        // Already a member — just take them there.
        router.push(`/groups/${preview?.groupId ?? ''}`);
        return;
      }
      setStatus('error');
      setMessage(
        e instanceof ApiError && e.status === 400
          ? 'This invite link is invalid or has expired.'
          : 'Could not join the group — try again.',
      );
    }
  };

  return (
    <AppShell title="Join group" back="/groups">
      {loading ? (
        <SkeletonList rows={2} />
      ) : status === 'error' ? (
        <div className="card empty" style={{ marginTop: 40 }}>
          <div className="empty-emoji" style={{ background: 'var(--negative-soft)' }}>
            😕
          </div>
          <div style={{ color: 'var(--text)', fontWeight: 600 }}>{message}</div>
          <a href="/groups" className="btn btn-ghost btn-sm" style={{ marginTop: 14 }}>
            Go to your groups
          </a>
        </div>
      ) : status === 'done' ? (
        <div className="card empty" style={{ marginTop: 40 }}>
          <div className="empty-emoji" style={{ background: 'var(--positive-soft)' }}>
            ✅
          </div>
          <div style={{ color: 'var(--text)', fontWeight: 600 }}>
            You&apos;re in! Opening {preview?.groupName}…
          </div>
        </div>
      ) : preview ? (
        <div className="card empty" style={{ marginTop: 40 }}>
          <div className="empty-emoji">🎉</div>
          <div style={{ color: 'var(--text)', fontWeight: 700, fontSize: 18 }}>
            Join “{preview.groupName}”?
          </div>
          <div className="muted" style={{ marginTop: 4 }}>
            {preview.memberCount} member{preview.memberCount === 1 ? '' : 's'} splitting expenses
          </div>
          {preview.alreadyMember ? (
            <a
              className="btn btn-primary"
              style={{ marginTop: 18 }}
              href={`/groups/${preview.groupId}`}
            >
              You&apos;re already in — open group
            </a>
          ) : (
            <button
              className="btn btn-primary"
              style={{ marginTop: 18, minWidth: 180 }}
              disabled={status === 'joining'}
              onClick={() => void join()}
            >
              {status === 'joining' ? 'Joining…' : 'Join group'}
            </button>
          )}
        </div>
      ) : null}
    </AppShell>
  );
}
