'use client';

import { useState } from 'react';
import { api, toMinor, memberName, type GroupDetail, type SplitPayload } from '../lib/api';
import { Modal } from './ui';

type Method = 'equal' | 'exact' | 'percentage' | 'shares' | 'itemized';

const METHODS: Array<{ key: Method; label: string }> = [
  { key: 'equal', label: 'Equal' },
  { key: 'exact', label: 'Exact' },
  { key: 'percentage', label: 'Percent' },
  { key: 'shares', label: 'Shares' },
  { key: 'itemized', label: 'Items' },
];

interface ItemDraft {
  description: string;
  amount: string;
  participants: Set<string>;
}

export function AddExpenseModal({
  group,
  token,
  onClose,
  onSaved,
}: {
  group: GroupDetail;
  token: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const members = group.members;
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [payer, setPayer] = useState(members[0]?.id ?? '');
  const [method, setMethod] = useState<Method>('equal');
  const [participants, setParticipants] = useState<Set<string>>(new Set(members.map((m) => m.id)));
  const [values, setValues] = useState<Record<string, string>>({});
  const [items, setItems] = useState<ItemDraft[]>([
    { description: '', amount: '', participants: new Set(members.map((m) => m.id)) },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const toggle = (id: string): void =>
    setParticipants((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const setValue = (id: string, v: string): void => setValues((p) => ({ ...p, [id]: v }));

  const updateItem = (i: number, patch: Partial<ItemDraft>): void =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const toggleItemMember = (i: number, id: string): void =>
    setItems((prev) =>
      prev.map((it, idx) => {
        if (idx !== i) return it;
        const next = new Set(it.participants);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return { ...it, participants: next };
      }),
    );
  const addItem = (): void =>
    setItems((p) => [
      ...p,
      { description: '', amount: '', participants: new Set(members.map((m) => m.id)) },
    ]);
  const removeItem = (i: number): void => setItems((p) => p.filter((_, idx) => idx !== i));

  const buildSplit = (amountMinor: number): SplitPayload | string => {
    if (method === 'itemized') {
      const built = [];
      for (const it of items) {
        if (!it.description.trim()) return 'Every item needs a description';
        const minor = toMinor(it.amount);
        if (minor === null || minor <= 0) return 'Every item needs a valid amount';
        if (it.participants.size === 0) return 'Every item needs at least one person';
        built.push({
          description: it.description.trim(),
          amountMinor: minor,
          participantMemberIds: [...it.participants],
        });
      }
      const sum = built.reduce((s, i) => s + i.amountMinor, 0);
      if (sum !== amountMinor)
        return `Items (${(sum / 100).toFixed(2)}) must add up to the total (${(amountMinor / 100).toFixed(2)})`;
      return { type: 'itemized', items: built };
    }

    const chosen = members.filter((m) => participants.has(m.id));
    if (chosen.length === 0) return 'Pick at least one person';

    if (method === 'equal') return { type: 'equal', participantMemberIds: chosen.map((m) => m.id) };

    if (method === 'exact') {
      const shares = chosen.map((m) => ({
        memberId: m.id,
        amountMinor: toMinor(values[m.id] ?? '') ?? -1,
      }));
      if (shares.some((s) => s.amountMinor < 0)) return 'Enter an amount for each person';
      const sum = shares.reduce((s, x) => s + x.amountMinor, 0);
      if (sum !== amountMinor)
        return `Exact amounts (${(sum / 100).toFixed(2)}) must equal the total (${(amountMinor / 100).toFixed(2)})`;
      return { type: 'exact', shares };
    }
    if (method === 'percentage') {
      const shares = chosen.map((m) => {
        const pct = Number(values[m.id]);
        return { memberId: m.id, percentBps: Number.isFinite(pct) ? Math.round(pct * 100) : -1 };
      });
      if (shares.some((s) => s.percentBps < 0)) return 'Enter a percentage for each person';
      const sum = shares.reduce((s, x) => s + x.percentBps, 0);
      if (sum !== 10000)
        return `Percentages must add up to 100% (currently ${(sum / 100).toFixed(1)}%)`;
      return { type: 'percentage', shares };
    }
    const shares = chosen.map((m) => ({ memberId: m.id, units: Number(values[m.id] ?? '1') }));
    if (shares.some((s) => !Number.isInteger(s.units) || s.units <= 0))
      return 'Shares must be positive whole numbers';
    return { type: 'shares', shares };
  };

  const submit = async (): Promise<void> => {
    setError(null);
    if (!description.trim()) return setError('Add a description');
    const amountMinor = toMinor(amount);
    if (amountMinor === null || amountMinor <= 0) return setError('Enter a valid amount');
    if (!payer) return setError('Choose who paid');
    const split = buildSplit(amountMinor);
    if (typeof split === 'string') return setError(split);

    setSaving(true);
    try {
      await api.createExpense(token, group.id, {
        description: description.trim(),
        amountMinor,
        currency: group.defaultCurrency,
        payerMemberId: payer,
        occurredAt: new Date().toISOString(),
        split,
      });
      onSaved();
    } catch {
      setError('Could not save the expense');
    } finally {
      setSaving(false);
    }
  };

  const itemsTotal = items.reduce((s, it) => s + (toMinor(it.amount) ?? 0), 0);
  const total = toMinor(amount);

  return (
    <Modal title="Add expense" onClose={onClose}>
      <div className="field">
        <label className="label">Description</label>
        <input
          className="input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Beach shack dinner"
          autoFocus
        />
      </div>
      <div className="field">
        <label className="label">Amount ({group.defaultCurrency})</label>
        <input
          className="input"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder="0.00"
        />
      </div>

      <div className="field">
        <label className="label">Paid by</label>
        <div className="chips">
          {members.map((m) => (
            <button
              key={m.id}
              className={`chip${payer === m.id ? ' active' : ''}`}
              onClick={() => setPayer(m.id)}
            >
              {memberName(members, m.id)}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label className="label">Split</label>
        <div className="chips">
          {METHODS.map((mth) => (
            <button
              key={mth.key}
              className={`chip${method === mth.key ? ' active' : ''}`}
              onClick={() => setMethod(mth.key)}
            >
              {mth.label}
            </button>
          ))}
        </div>
      </div>

      {method !== 'itemized' ? (
        <div className="field">
          <label className="label">
            {method === 'equal'
              ? 'Split between'
              : method === 'exact'
                ? 'Exact amount each'
                : method === 'percentage'
                  ? 'Percentage each'
                  : 'Shares each'}
          </label>
          <div className="stack" style={{ gap: 8 }}>
            {members.map((m) => {
              const on = participants.has(m.id);
              return (
                <div key={m.id} className="between">
                  <label className="row" style={{ gap: 9, cursor: 'pointer' }}>
                    <input type="checkbox" checked={on} onChange={() => toggle(m.id)} />
                    {memberName(members, m.id)}
                  </label>
                  {on && method !== 'equal' && (
                    <input
                      className="input"
                      style={{ width: 100, textAlign: 'right' }}
                      inputMode={method === 'shares' ? 'numeric' : 'decimal'}
                      placeholder={
                        method === 'exact' ? '0.00' : method === 'percentage' ? '%' : '1'
                      }
                      value={values[m.id] ?? ''}
                      onChange={(e) => setValue(m.id, e.target.value)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="field">
          <label className="label">Line items</label>
          <div className="stack" style={{ gap: 12 }}>
            {items.map((it, i) => (
              <div key={i} className="card card-pad" style={{ boxShadow: 'none' }}>
                <div className="row" style={{ marginBottom: 8 }}>
                  <input
                    className="input"
                    style={{ flex: 1 }}
                    placeholder={`Item ${i + 1}`}
                    value={it.description}
                    onChange={(e) => updateItem(i, { description: e.target.value })}
                  />
                  <input
                    className="input"
                    style={{ width: 100, textAlign: 'right' }}
                    inputMode="decimal"
                    placeholder="0.00"
                    value={it.amount}
                    onChange={(e) => updateItem(i, { amount: e.target.value })}
                  />
                </div>
                <div className="chips">
                  {members.map((m) => (
                    <button
                      key={m.id}
                      className={`chip${it.participants.has(m.id) ? ' active' : ''}`}
                      onClick={() => toggleItemMember(i, m.id)}
                    >
                      {memberName(members, m.id)}
                    </button>
                  ))}
                </div>
                {items.length > 1 && (
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ marginTop: 8 }}
                    onClick={() => removeItem(i)}
                  >
                    Remove item
                  </button>
                )}
              </div>
            ))}
            <button className="btn btn-ghost btn-sm" onClick={addItem}>
              + Add item
            </button>
            {total !== null && (
              <div className={itemsTotal === total ? 'success-text' : 'error'}>
                Items {(itemsTotal / 100).toFixed(2)} / {(total / 100).toFixed(2)}
                {itemsTotal === total ? ' ✓' : ' — must match total'}
              </div>
            )}
          </div>
        </div>
      )}

      {error && <p className="error">{error}</p>}
      <button
        className="btn btn-primary btn-block"
        onClick={() => void submit()}
        disabled={saving}
        style={{ marginTop: 8 }}
      >
        {saving ? 'Saving…' : 'Save expense'}
      </button>
    </Modal>
  );
}
