'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../lib/auth';
import {
  api,
  ApiError,
  formatMoney,
  memberName,
  memberUpi,
  memberColor,
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
  Toast,
  type ToastState,
} from '../../../components/ui';
import { AddExpenseModal } from '../../../components/AddExpenseModal';
import { SettleUpModal } from '../../../components/SettleUpModal';
import { buildBalanceSheet } from '../../../lib/balances';
import {
  downloadBalanceSheetPdf,
  downloadBalanceSheetCsv,
} from '../../../lib/balance-sheet-export';

type Tab = 'expenses' | 'balances' | 'activity';

/** Pick a category glyph from the description so rows read like a real ledger. */
function categoryEmoji(description: string): string {
  const d = description.toLowerCase();
  const map: Array<[RegExp, string]> = [
    [/food|dinner|lunch|breakfast|snack|shack|restaurant|cafe|coffee|pizza|meal/, '🍽️'],
    [/grocer|super ?market|vegetable|milk|kirana/, '🛒'],
    [/cab|uber|ola|taxi|auto|fuel|petrol|diesel|train|flight|bus|travel|trip/, '🚕'],
    [/hotel|stay|room|airbnb|resort/, '🏨'],
    [/movie|game|fun|party|drink|bar|beer/, '🎉'],
    [/rent|electricity|water|wifi|internet|bill|gas/, '🧾'],
    [/shop|amazon|flipkart|clothes|gift/, '🛍️'],
  ];
  for (const [re, emoji] of map) if (re.test(d)) return emoji;
  return '🧾';
}

/** This user's involvement in one expense, for the Splitwise-style right column. */
function involvement(
  e: Expense,
  myMemberId: string | null,
): { label: string; amount: number; tone: 'pos' | 'neg' | 'muted' } {
  if (!myMemberId) return { label: '', amount: 0, tone: 'muted' };
  const myShare = e.splits
    .filter((s) => s.memberId === myMemberId)
    .reduce((sum, s) => sum + s.shareMinor, 0);
  if (e.payerMemberId === myMemberId) {
    const lent = e.amountMinor - myShare;
    return lent > 0
      ? { label: 'you lent', amount: lent, tone: 'pos' }
      : { label: 'you paid', amount: e.amountMinor, tone: 'muted' };
  }
  if (myShare > 0) return { label: 'you borrowed', amount: myShare, tone: 'neg' };
  return { label: 'not involved', amount: 0, tone: 'muted' };
}

export default function GroupDetailPage() {
  const { token, ready, signOut } = useAuth();
  const router = useRouter();
  const groupId = useParams<{ id: string }>().id;
  const openAdd = useSearchParams().get('new') === '1';

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balances, setBalances] = useState<GroupBalances | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [myMemberId, setMyMemberId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [tab, setTab] = useState<Tab>('expenses');
  const [adding, setAdding] = useState(openAdd);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [settling, setSettling] = useState<Transfer | 'blank' | null>(null);
  const [openComments, setOpenComments] = useState<Expense | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Expense | null>(null);
  const [managing, setManaging] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [me, g, page, bal, act] = await Promise.all([
        api.me(token),
        api.getGroup(token, groupId),
        api.listExpenses(token, groupId),
        api.getBalances(token, groupId),
        api.listActivity(token, groupId),
      ]);
      setGroup(g);
      setExpenses(page.items);
      setBalances(bal);
      setActivity(act.items);
      setMyMemberId(g.members.find((m) => m.userId === me.id)?.id ?? null);
      setLoadError(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        signOut();
        router.push('/login');
        return;
      }
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
        <div className="skeleton" style={{ height: 100, marginBottom: 16 }} />
        <SkeletonList rows={4} />
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

  const currency = group.defaultCurrency;
  const myNet = myMemberId ? (balances?.nets[currency]?.[myMemberId] ?? 0) : 0;

  return (
    <AppShell
      title={group.name}
      back="/groups"
      headerRight={
        <button className="btn btn-ghost btn-sm" onClick={() => setManaging(true)}>
          People
        </button>
      }
    >
      <>
        {/* Group balance summary (Splitwise-style) */}
        <div className="hero between" style={{ alignItems: 'flex-start' }}>
          <div>
            <div className="hero-label">
              {myNet === 0 ? 'In this group' : myNet > 0 ? 'You are owed' : 'You owe'}
            </div>
            <div className={`hero-amount ${myNet > 0 ? 'pos' : myNet < 0 ? 'neg' : ''}`}>
              {myNet === 0 ? "You're settled up" : formatMoney(Math.abs(myNet), currency)}
            </div>
            <div className="row" style={{ gap: 0, marginTop: 12 }}>
              {group.members.slice(0, 6).map((m, i) => (
                <span
                  key={m.id}
                  title={memberName(group.members, m.id)}
                  style={{
                    marginLeft: i === 0 ? 0 : -8,
                    border: '2px solid var(--surface)',
                    borderRadius: '50%',
                  }}
                >
                  <Avatar
                    name={memberName(group.members, m.id)}
                    size={30}
                    color={memberColor(group.members, m.id)}
                  />
                </span>
              ))}
              {group.members.length > 6 && (
                <span className="faint" style={{ marginLeft: 6, fontSize: 13 }}>
                  +{group.members.length - 6}
                </span>
              )}
            </div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setSettling('blank')}>
            Settle up
          </button>
        </div>

        <div className="tabs" style={{ margin: '18px 0' }} role="tablist" aria-label="Group views">
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
              myMemberId={myMemberId}
              onComments={setOpenComments}
              onDelete={(e) => setConfirmDelete(e)}
            />
          )}
          {tab === 'balances' && (
            <BalancesTab
              group={group}
              balances={balances}
              expenses={expenses}
              onSettle={(t) => setSettling(t)}
            />
          )}
          {tab === 'activity' && <ActivityTab group={group} activity={activity} />}
        </div>

        <button className="fab" onClick={() => setAdding(true)}>
          + Add expense
        </button>

        {adding && token && (
          <AddExpenseModal
            group={group}
            token={token}
            onClose={() => setAdding(false)}
            onSaved={() => {
              setAdding(false);
              setToast({ message: 'Expense added', kind: 'success' });
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
              setToast({ message: 'Payment recorded', kind: 'success' });
              void load();
            }}
          />
        )}
        {managing && token && (
          <ManagePeopleModal
            group={group}
            token={token}
            onClose={() => setManaging(false)}
            onChanged={() => void load()}
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
        <Toast toast={toast} onDone={() => setToast(null)} />
      </>
    </AppShell>
  );
}

function ExpensesTab({
  group,
  expenses,
  myMemberId,
  onComments,
  onDelete,
}: {
  group: GroupDetail;
  expenses: Expense[];
  myMemberId: string | null;
  onComments: (e: Expense) => void;
  onDelete: (e: Expense) => void;
}) {
  if (expenses.length === 0) {
    return (
      <div className="card empty">
        <div className="empty-emoji">🧾</div>
        <div style={{ fontWeight: 600, color: 'var(--text)' }}>No expenses yet</div>
        <div>Tap “+ Add expense” to add the first one.</div>
      </div>
    );
  }
  return (
    <div className="card card-pad">
      {expenses.map((e) => {
        const inv = involvement(e, myMemberId);
        const d = new Date(e.occurredAt);
        return (
          <div key={e.id} className="exp-row">
            <div className="date-cell">
              <div className="m">{d.toLocaleString('en-US', { month: 'short' })}</div>
              <div className="d">{d.getDate()}</div>
            </div>
            <span className="cat-icon" aria-hidden>
              {categoryEmoji(e.description)}
            </span>
            <div className="exp-main">
              <div className="t">{e.description}</div>
              <div className="faint" style={{ fontSize: 13 }}>
                {memberName(group.members, e.payerMemberId)} paid{' '}
                {formatMoney(e.amountMinor, e.currency)}
              </div>
              <div className="row" style={{ gap: 14, marginTop: 4 }}>
                <button
                  className="faint"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}
                  onClick={() => onComments(e)}
                >
                  💬 Comment
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
            <div className="bal-side">
              <div className="l">{inv.label}</div>
              {inv.amount > 0 && (
                <div
                  className={`v ${inv.tone === 'pos' ? 'pos' : inv.tone === 'neg' ? 'neg' : ''}`}
                >
                  {formatMoney(inv.amount, e.currency)}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** A payee's UPI ID as a tap-to-copy control (no more manual selection). */
function CopyVpa({ vpa }: { vpa: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(vpa);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the id stays visible for manual copy */
    }
  };
  return (
    <button
      className="pos"
      onClick={() => void copy()}
      title="Copy UPI ID"
      style={{
        font: 'inherit',
        fontSize: 12,
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
      }}
    >
      UPI: {vpa} {copied ? '✓ copied' : '⧉'}
    </button>
  );
}

function BalancesTab({
  group,
  balances,
  expenses,
  onSettle,
}: {
  group: GroupDetail;
  balances: GroupBalances | null;
  expenses: Expense[];
  onSettle: (t: Transfer | 'blank') => void;
}) {
  if (!balances) return <SkeletonList rows={3} />;
  const currency = group.defaultCurrency;
  const nets = balances.nets[currency] ?? {};
  const settlements = balances.settlements;

  const exportSheet = (kind: 'pdf' | 'csv'): void => {
    const sheet = buildBalanceSheet(group, expenses, balances);
    if (kind === 'pdf') downloadBalanceSheetPdf(sheet);
    else downloadBalanceSheetCsv(sheet);
  };

  return (
    <div className="stack">
      <div className="card card-pad">
        <div className="section-title">Net balances</div>
        {group.members.map((m) => {
          const net = nets[m.id] ?? 0;
          return (
            <div key={m.id} className="list-item">
              <div className="row" style={{ gap: 12 }}>
                <Avatar
                  name={memberName(group.members, m.id)}
                  color={memberColor(group.members, m.id)}
                />
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
                  <Avatar
                    name={memberName(group.members, t.fromMemberId)}
                    size={32}
                    color={memberColor(group.members, t.fromMemberId)}
                  />
                  <span className="faint" aria-hidden>
                    →
                  </span>
                  <Avatar
                    name={memberName(group.members, t.toMemberId)}
                    size={32}
                    color={memberColor(group.members, t.toMemberId)}
                  />
                  <div>
                    <div style={{ fontSize: 14 }}>
                      <strong>{memberName(group.members, t.fromMemberId)}</strong> →{' '}
                      <strong>{memberName(group.members, t.toMemberId)}</strong>
                    </div>
                    {vpa && <CopyVpa vpa={vpa} />}
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

      <div className="card card-pad">
        <div className="section-title">Balance sheet</div>
        <p className="faint" style={{ fontSize: 13, margin: '0 0 12px' }}>
          A shareable summary — members, contributions, shares, who owes whom, and the full expense
          history.
        </p>
        <div className="row">
          <button
            className="btn btn-primary btn-block"
            onClick={() => exportSheet('pdf')}
            disabled={expenses.length === 0}
          >
            ⬇ Download PDF
          </button>
          <button
            className="btn btn-ghost btn-block"
            onClick={() => exportSheet('csv')}
            disabled={expenses.length === 0}
          >
            Export CSV
          </button>
        </div>
        {expenses.length === 0 && (
          <p className="faint" style={{ fontSize: 12, margin: '10px 0 0' }}>
            Add an expense to generate a balance sheet.
          </p>
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

/** Invite by link + add a guest, in one sheet (keeps the expense list clean). */
function ManagePeopleModal({
  group,
  token,
  onClose,
  onChanged,
}: {
  group: GroupDetail;
  token: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [busy, setBusy] = useState(false);

  const invite = async (): Promise<void> => {
    setBusy(true);
    try {
      const { token: inv } = await api.createInvite(token, group.id);
      setInviteLink(`${window.location.origin}/join/${inv}`);
      setCopied(false);
    } catch {
      setInviteLink('error');
    } finally {
      setBusy(false);
    }
  };

  const copyInvite = async (): Promise<void> => {
    if (!inviteLink || inviteLink === 'error') return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
    } catch {
      /* clipboard blocked — link still shown for manual copy */
    }
  };

  const addGuest = async (): Promise<void> => {
    if (!guestName.trim()) return;
    setBusy(true);
    try {
      await api.addGuest(token, group.id, guestName.trim());
      setGuestName('');
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="People" onClose={onClose}>
      <div className="section-title">Members ({group.members.length})</div>
      <div className="stack" style={{ gap: 8, marginBottom: 18 }}>
        {group.members.map((m) => (
          <div key={m.id} className="row" style={{ gap: 10 }}>
            <Avatar
              name={memberName(group.members, m.id)}
              size={32}
              color={memberColor(group.members, m.id)}
            />
            <span style={{ fontWeight: 600 }}>{memberName(group.members, m.id)}</span>
            {!m.userId && <span className="badge">guest</span>}
          </div>
        ))}
      </div>

      <div className="section-title">Invite by link</div>
      {inviteLink && inviteLink !== 'error' ? (
        <div className="row" style={{ marginBottom: 18 }}>
          <input className="input mono" readOnly value={inviteLink} />
          <button className="btn btn-primary btn-sm" onClick={() => void copyInvite()}>
            {copied ? 'Copied ✓' : 'Copy'}
          </button>
        </div>
      ) : (
        <>
          {inviteLink === 'error' && (
            <p className="error" style={{ marginTop: 0 }}>
              Could not create an invite link. Is the API running?
            </p>
          )}
          <button
            className="btn btn-ghost btn-block"
            style={{ marginBottom: 18 }}
            onClick={() => void invite()}
            disabled={busy}
          >
            Create invite link
          </button>
        </>
      )}

      <div className="section-title">Add a guest (no account needed)</div>
      <div className="row">
        <input
          className="input"
          placeholder="Guest name"
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void addGuest()}
        />
        <button
          className="btn btn-ghost"
          onClick={() => void addGuest()}
          disabled={!guestName.trim() || busy}
        >
          Add
        </button>
      </div>
    </Modal>
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
