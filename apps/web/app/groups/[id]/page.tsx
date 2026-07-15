'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth';
import {
  api,
  formatMoney,
  memberName,
  memberUpi,
  type GroupDetail,
  type Expense,
  type GroupBalances,
  type ActivityEntry,
  type Transfer,
  type Comment,
} from '../../../lib/api';
import {
  AppShell,
  Avatar,
  Modal,
  SkeletonList,
  ErrorState,
  ConfirmDialog,
} from '../../../components/ui';
import { AddExpenseModal } from '../../../components/AddExpenseModal';
import { SettleUpModal } from '../../../components/SettleUpModal';

type Tab = 'expenses' | 'balances' | 'activity';

export default function GroupDetailPage() {
  const { token, ready } = useAuth();
  const router = useRouter();
  const groupId = useParams<{ id: string }>().id;

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balances, setBalances] = useState<GroupBalances | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [tab, setTab] = useState<Tab>('expenses');
  const [adding, setAdding] = useState(false);
  const [settling, setSettling] = useState<Transfer | 'blank' | null>(null);
  const [openComments, setOpenComments] = useState<Expense | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Expense | null>(null);
  const [guestName, setGuestName] = useState('');
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [g, page, bal, act] = await Promise.all([
        api.getGroup(token, groupId),
        api.listExpenses(token, groupId),
        api.getBalances(token, groupId),
        api.listActivity(token, groupId),
      ]);
      setGroup(g);
      setExpenses(page.items);
      setBalances(bal);
      setActivity(act.items);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [token, groupId]);

  useEffect(() => {
    if (ready && !token) router.push('/login');
  }, [ready, token, router]);
  useEffect(() => {
    void load();
  }, [load]);

  const invite = async (): Promise<void> => {
    if (!token) return;
    try {
      const { token: inv } = await api.createInvite(token, groupId);
      setInviteLink(`${window.location.origin}/join/${inv}`);
      setCopied(false);
    } catch {
      setInviteLink('error');
    }
  };

  const copyInvite = async (): Promise<void> => {
    if (!inviteLink || inviteLink === 'error') return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
    } catch {
      /* clipboard blocked — the link is still shown for manual copy */
    }
  };

  const addGuest = async (): Promise<void> => {
    if (!token || !guestName.trim()) return;
    await api.addGuest(token, groupId, guestName.trim());
    setGuestName('');
    await load();
  };

  const doDelete = async (): Promise<void> => {
    if (!token || !confirmDelete) return;
    const id = confirmDelete.id;
    setConfirmDelete(null);
    await api.deleteExpense(token, groupId, id);
    await load();
  };

  if (loading && !group) {
    return (
      <AppShell title="Group" back="/groups">
        <SkeletonList rows={5} />
      </AppShell>
    );
  }

  if (loadError && !group) {
    return (
      <AppShell title="Group" back="/groups">
        <ErrorState message="Could not load this group" onRetry={() => void load()} />
      </AppShell>
    );
  }

  if (!group) return null;

  return (
    <AppShell
      title={group.name}
      back="/groups"
      headerRight={
        <button className="btn btn-ghost btn-sm" onClick={() => void invite()}>
          Invite
        </button>
      }
    >
      <>
        {inviteLink && (
          <div className="card card-pad" style={{ marginBottom: 16 }}>
            <div className="between" style={{ marginBottom: 8 }}>
              <div className="section-title" style={{ marginBottom: 0 }}>
                Invite link
              </div>
              <button
                className="faint"
                aria-label="Dismiss"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                onClick={() => setInviteLink(null)}
              >
                ✕
              </button>
            </div>
            {inviteLink === 'error' ? (
              <p className="error" style={{ margin: 0 }}>
                Could not create an invite link. Is the API running?
              </p>
            ) : (
              <div className="row">
                <input className="input mono" readOnly value={inviteLink} />
                <button className="btn btn-primary btn-sm" onClick={() => void copyInvite()}>
                  {copied ? 'Copied ✓' : 'Copy'}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="between" style={{ margin: '0 0 18px' }}>
          <div className="row" style={{ gap: 0 }}>
            {group.members.slice(0, 6).map((m, i) => (
              <span
                key={m.id}
                style={{
                  marginLeft: i === 0 ? 0 : -8,
                  border: '2px solid var(--surface)',
                  borderRadius: '50%',
                }}
              >
                <Avatar name={memberName(group.members, m.id)} size={34} />
              </span>
            ))}
            {group.members.length > 6 && (
              <span className="faint" style={{ marginLeft: 6, fontSize: 13 }}>
                +{group.members.length - 6}
              </span>
            )}
          </div>
        </div>

        <div className="tabs" style={{ marginBottom: 18 }} role="tablist" aria-label="Group views">
          {(['expenses', 'balances', 'activity'] as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              id={`tab-${t}`}
              aria-selected={tab === t}
              aria-controls={`panel-${t}`}
              className={`tab${tab === t ? ' active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t[0]!.toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div
          role="tabpanel"
          id={`panel-${tab}`}
          aria-labelledby={`tab-${tab}`}
          tabIndex={0}
          style={{ outline: 'none' }}
        >
          {tab === 'expenses' && (
            <ExpensesTab
              group={group}
              expenses={expenses}
              onComments={setOpenComments}
              onDelete={(e) => setConfirmDelete(e)}
              guestName={guestName}
              setGuestName={setGuestName}
              onAddGuest={() => void addGuest()}
            />
          )}
          {tab === 'balances' && (
            <BalancesTab group={group} balances={balances} onSettle={(t) => setSettling(t)} />
          )}
          {tab === 'activity' && <ActivityTab group={group} activity={activity} />}
        </div>

        <button className="fab" style={{ bottom: 24 }} onClick={() => setAdding(true)}>
          + Add expense
        </button>

        {adding && token && (
          <AddExpenseModal
            group={group}
            token={token}
            onClose={() => setAdding(false)}
            onSaved={() => {
              setAdding(false);
              void load();
            }}
          />
        )}
        {settling && token && (
          <SettleUpModal
            group={group}
            token={token}
            suggested={settling === 'blank' ? undefined : settling}
            onClose={() => setSettling(null)}
            onSaved={() => {
              setSettling(null);
              void load();
            }}
          />
        )}
        {openComments && token && (
          <CommentsModal
            group={group}
            token={token}
            expense={openComments}
            onClose={() => setOpenComments(null)}
          />
        )}
        {confirmDelete && (
          <ConfirmDialog
            title="Delete expense?"
            message={`"${confirmDelete.description}" (${formatMoney(confirmDelete.amountMinor, confirmDelete.currency)}) will be removed and balances recalculated. This can't be undone.`}
            onConfirm={() => void doDelete()}
            onCancel={() => setConfirmDelete(null)}
          />
        )}
      </>
    </AppShell>
  );
}

function ExpensesTab({
  group,
  expenses,
  onComments,
  onDelete,
  guestName,
  setGuestName,
  onAddGuest,
}: {
  group: GroupDetail;
  expenses: Expense[];
  onComments: (e: Expense) => void;
  onDelete: (e: Expense) => void;
  guestName: string;
  setGuestName: (v: string) => void;
  onAddGuest: () => void;
}) {
  return (
    <>
      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <label className="label" htmlFor="guest-name">
          Add a guest (no account needed)
        </label>
        <div className="row">
          <input
            id="guest-name"
            className="input"
            placeholder="Guest name"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onAddGuest()}
          />
          <button className="btn btn-ghost" onClick={onAddGuest} disabled={!guestName.trim()}>
            Add
          </button>
        </div>
      </div>

      {expenses.length === 0 ? (
        <div className="card empty">
          <div className="empty-emoji">🧾</div>
          <div style={{ fontWeight: 600, color: 'var(--text)' }}>No expenses yet</div>
          <div>Tap the “+ Add expense” button to add the first one.</div>
        </div>
      ) : (
        <div className="card card-pad">
          {expenses.map((e) => (
            <div key={e.id} className="list-item">
              <div className="row" style={{ gap: 12 }}>
                <Avatar name={memberName(group.members, e.payerMemberId)} />
                <div>
                  <div style={{ fontWeight: 600 }}>{e.description}</div>
                  <div className="faint" style={{ fontSize: 13 }}>
                    {memberName(group.members, e.payerMemberId)} paid ·{' '}
                    <span className="badge" style={{ padding: '1px 7px' }}>
                      {e.splitType}
                    </span>
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="amount">{formatMoney(e.amountMinor, e.currency)}</div>
                <div className="row" style={{ gap: 12, justifyContent: 'flex-end', marginTop: 4 }}>
                  <button
                    className="faint"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}
                    onClick={() => onComments(e)}
                  >
                    💬 Comments
                  </button>
                  <button
                    className="neg"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}
                    onClick={() => onDelete(e)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function BalancesTab({
  group,
  balances,
  onSettle,
}: {
  group: GroupDetail;
  balances: GroupBalances | null;
  onSettle: (t: Transfer | 'blank') => void;
}) {
  if (!balances) return <SkeletonList rows={3} />;
  const currency = group.defaultCurrency;
  const nets = balances.nets[currency] ?? {};
  const settlements = balances.settlements;

  return (
    <div className="stack">
      <div className="card card-pad">
        <div className="section-title">Net balances</div>
        {group.members.map((m) => {
          const net = nets[m.id] ?? 0;
          return (
            <div key={m.id} className="list-item">
              <div className="row" style={{ gap: 12 }}>
                <Avatar name={memberName(group.members, m.id)} />
                <span style={{ fontWeight: 600 }}>{memberName(group.members, m.id)}</span>
              </div>
              {net === 0 ? (
                <span className="faint amount">settled</span>
              ) : (
                <span className={net > 0 ? 'pill-pos amount' : 'pill-neg amount'}>
                  {net > 0 ? 'gets ' : 'owes '}
                  {formatMoney(Math.abs(net), currency)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="card card-pad">
        <div className="between" style={{ marginBottom: 4 }}>
          <div className="section-title" style={{ marginBottom: 0 }}>
            Suggested settle-up
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => onSettle('blank')}>
            Record payment
          </button>
        </div>
        {settlements.length === 0 ? (
          <div className="empty" style={{ padding: '24px 0' }}>
            <div className="empty-emoji" style={{ background: 'var(--positive-soft)' }}>
              🎉
            </div>
            <div>All settled up</div>
          </div>
        ) : (
          settlements.map((t, i) => {
            const vpa = memberUpi(group.members, t.toMemberId);
            return (
              <div key={i} className="list-item">
                <div className="row" style={{ gap: 8 }}>
                  <Avatar name={memberName(group.members, t.fromMemberId)} size={32} />
                  <span className="faint" aria-hidden>
                    →
                  </span>
                  <Avatar name={memberName(group.members, t.toMemberId)} size={32} />
                  <div>
                    <div style={{ fontSize: 14 }}>
                      <strong>{memberName(group.members, t.fromMemberId)}</strong> →{' '}
                      <strong>{memberName(group.members, t.toMemberId)}</strong>
                    </div>
                    {vpa && (
                      <div className="pos" style={{ fontSize: 12 }}>
                        UPI: {vpa}
                      </div>
                    )}
                  </div>
                </div>
                <div className="row" style={{ gap: 10 }}>
                  <span className="amount">{formatMoney(t.amountMinor, t.currency)}</span>
                  <button className="btn btn-success btn-sm" onClick={() => onSettle(t)}>
                    Settle
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function ActivityTab({ group, activity }: { group: GroupDetail; activity: ActivityEntry[] }) {
  if (activity.length === 0)
    return (
      <div className="card empty">
        <div className="empty-emoji">📜</div>
        <div>No activity yet.</div>
      </div>
    );
  const describe = (a: ActivityEntry): string => {
    const noun = a.entityType === 'payment' ? 'settlement' : a.entityType;
    const desc = typeof a.payload.description === 'string' ? ` “${a.payload.description}”` : '';
    return `${a.action} ${noun}${desc}`;
  };
  return (
    <div className="card card-pad">
      {activity.map((a) => (
        <div key={a.id} className="list-item">
          <div style={{ textTransform: 'capitalize' }}>{describe(a)}</div>
          <div className="faint" style={{ fontSize: 12 }}>
            {new Date(a.createdAt).toLocaleString()}
          </div>
        </div>
      ))}
      <span style={{ display: 'none' }}>{group.id}</span>
    </div>
  );
}

function CommentsModal({
  group,
  token,
  expense,
  onClose,
}: {
  group: GroupDetail;
  token: string;
  expense: Expense;
  onClose: () => void;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      setComments(await api.listComments(token, group.id, expense.id));
      setError(null);
    } catch {
      setError('Could not load comments');
    }
  }, [token, group.id, expense.id]);
  useEffect(() => {
    void load();
  }, [load]);

  const send = async (): Promise<void> => {
    if (!body.trim()) return;
    setSending(true);
    try {
      await api.addComment(token, group.id, expense.id, body.trim());
      setBody('');
      await load();
    } catch {
      setError('Could not post your comment');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal title={expense.description} onClose={onClose}>
      <div className="amount" style={{ marginBottom: 12 }}>
        {formatMoney(expense.amountMinor, expense.currency)}
      </div>
      <div className="stack" style={{ gap: 8, marginBottom: 14 }}>
        {comments.length === 0 && !error && <p className="faint">No comments yet.</p>}
        {comments.map((c) => (
          <div
            key={c.id}
            className="card card-pad"
            style={{ boxShadow: 'none', padding: 12, background: 'var(--surface-2)' }}
          >
            <div>{c.body}</div>
            <div className="faint" style={{ fontSize: 11, marginTop: 3 }}>
              {new Date(c.createdAt).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <input
          className="input"
          placeholder="Add a comment"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void send()}
        />
        <button
          className="btn btn-primary"
          onClick={() => void send()}
          disabled={!body.trim() || sending}
        >
          Send
        </button>
      </div>
    </Modal>
  );
}
