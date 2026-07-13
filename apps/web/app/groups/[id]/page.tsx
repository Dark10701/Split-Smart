'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth';
import {
  api,
  formatMoney,
  type GroupDetail,
  type GroupMember,
  type Expense,
  type GroupBalances,
} from '../../../lib/api';

function memberName(members: GroupMember[], id: string): string {
  const m = members.find((x) => x.id === id);
  return m ? (m.guestName ?? (m.userId ? 'Member' : 'Guest')) : 'Unknown';
}

/** Parse a decimal major-unit string into integer minor units. */
function toMinor(input: string): number | null {
  const t = input.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const [whole, frac = ''] = t.split('.');
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}

export default function GroupDetailPage() {
  const { token, ready } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const groupId = params.id;

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balances, setBalances] = useState<GroupBalances | null>(null);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [payer, setPayer] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    const [g, page, bal] = await Promise.all([
      api.getGroup(token, groupId),
      api.listExpenses(token, groupId),
      api.getBalances(token, groupId),
    ]);
    setGroup(g);
    setExpenses(page.items);
    setBalances(bal);
    if (!payer && g.members[0]) setPayer(g.members[0].id);
  }, [token, groupId, payer]);

  useEffect(() => {
    if (ready && !token) router.push('/login');
  }, [ready, token, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const addExpense = async (): Promise<void> => {
    setError(null);
    if (!token || !group) return;
    const amountMinor = toMinor(amount);
    if (!description.trim()) return setError('Add a description');
    if (amountMinor === null || amountMinor <= 0) return setError('Enter a valid amount');
    if (!payer) return setError('Choose who paid');
    try {
      await api.createExpense(token, groupId, {
        description: description.trim(),
        amountMinor,
        currency: group.defaultCurrency,
        payerMemberId: payer,
        occurredAt: new Date().toISOString(),
        split: { type: 'equal', participantMemberIds: group.members.map((m) => m.id) },
      });
      setDescription('');
      setAmount('');
      await load();
    } catch {
      setError('Could not save the expense');
    }
  };

  if (!group) return <main style={wrap}>Loading…</main>;

  return (
    <main style={wrap}>
      <a href="/groups">← Groups</a>
      <h1>{group.name}</h1>

      <section style={{ border: '1px solid #E5E7EB', borderRadius: 8, padding: 16, margin: '16px 0' }}>
        <h3>Add expense (split equally)</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} style={{ padding: 10, flex: 2 }} />
          <input placeholder={`Amount (${group.defaultCurrency})`} value={amount} onChange={(e) => setAmount(e.target.value)} style={{ padding: 10, flex: 1 }} />
          <select value={payer} onChange={(e) => setPayer(e.target.value)} style={{ padding: 10 }}>
            {group.members.map((m) => (
              <option key={m.id} value={m.id}>
                {memberName(group.members, m.id)}
              </option>
            ))}
          </select>
          <button onClick={() => void addExpense()} style={{ padding: '10px 16px' }}>Add</button>
        </div>
        {error && <p style={{ color: '#DC2626' }}>{error}</p>}
      </section>

      <h3>Expenses</h3>
      <ul>
        {expenses.map((e) => (
          <li key={e.id}>
            {e.description} — <strong>{formatMoney(e.amountMinor, e.currency)}</strong>{' '}
            <span style={{ color: '#6B7280' }}>
              ({memberName(group.members, e.payerMemberId)} paid, {e.splitType})
            </span>
          </li>
        ))}
        {expenses.length === 0 && <p style={{ color: '#6B7280' }}>No expenses yet.</p>}
      </ul>

      <h3>Who owes whom</h3>
      {balances && balances.settlements.length > 0 ? (
        <ul>
          {balances.settlements.map((t, i) => (
            <li key={i}>
              <strong>{memberName(group.members, t.fromMemberId)}</strong> owes{' '}
              <strong>{memberName(group.members, t.toMemberId)}</strong>{' '}
              {formatMoney(t.amountMinor, t.currency)}
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ color: '#6B7280' }}>All settled up 🎉</p>
      )}
    </main>
  );
}

const wrap: React.CSSProperties = { maxWidth: 640, margin: '48px auto', padding: 16 };
