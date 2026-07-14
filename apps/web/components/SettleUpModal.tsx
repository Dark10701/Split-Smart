'use client';

import { useState } from 'react';
import { buildUpiPayUri } from '@splitsmart/types';
import {
  api,
  toMinor,
  memberName,
  memberUpi,
  formatMoney,
  type GroupDetail,
  type Transfer,
} from '../lib/api';
import { Modal } from './ui';

function newKey(): string {
  return `settle-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function SettleUpModal({
  group,
  token,
  suggested,
  onClose,
  onSaved,
}: {
  group: GroupDetail;
  token: string;
  suggested?: Transfer;
  onClose: () => void;
  onSaved: () => void;
}) {
  const members = group.members;
  const [from, setFrom] = useState(suggested?.fromMemberId ?? members[0]?.id ?? '');
  const [to, setTo] = useState(suggested?.toMemberId ?? members[1]?.id ?? '');
  const [amount, setAmount] = useState(suggested ? (suggested.amountMinor / 100).toFixed(2) : '');
  const [method, setMethod] = useState<'cash' | 'upi' | 'offline'>('cash');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const currency = suggested?.currency ?? group.defaultCurrency;
  // UPI links are INR-only (cu=INR, paise): hide for any non-INR settlement.
  const payeeVpa = currency === 'INR' ? memberUpi(members, to) : null;

  const payViaUpi = (): void => {
    setError(null);
    const amountMinor = toMinor(amount);
    if (amountMinor === null || amountMinor <= 0) return setError('Enter a valid amount first');
    if (!payeeVpa) return;
    setMethod('upi');
    const uri = buildUpiPayUri({
      payeeVpa,
      payeeName: memberName(members, to),
      amountPaise: amountMinor,
      note: `SplitSmart · ${group.name}`,
    });
    window.location.href = uri;
  };

  const submit = async (): Promise<void> => {
    setError(null);
    if (from === to) return setError('Payer and payee must differ');
    const amountMinor = toMinor(amount);
    if (amountMinor === null || amountMinor <= 0) return setError('Enter a valid amount');
    setSaving(true);
    try {
      await api.recordSettlement(token, group.id, {
        fromMemberId: from,
        toMemberId: to,
        amountMinor,
        currency,
        method,
        idempotencyKey: newKey(),
      });
      onSaved();
    } catch {
      setError('Could not record the settlement');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Record a payment" onClose={onClose}>
      <div className="field">
        <span className="label" id="settle-from-label">
          Who paid
        </span>
        <div className="chips" role="group" aria-labelledby="settle-from-label">
          {members.map((m) => (
            <button
              key={m.id}
              className={`chip${from === m.id ? ' active' : ''}`}
              aria-pressed={from === m.id}
              onClick={() => setFrom(m.id)}
            >
              {memberName(members, m.id)}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <span className="label" id="settle-to-label">
          Paid to
        </span>
        <div className="chips" role="group" aria-labelledby="settle-to-label">
          {members.map((m) => (
            <button
              key={m.id}
              className={`chip${to === m.id ? ' active' : ''}`}
              aria-pressed={to === m.id}
              onClick={() => setTo(m.id)}
            >
              {memberName(members, m.id)}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <label className="label" htmlFor="settle-amount">
          Amount ({currency})
        </label>
        <input
          id="settle-amount"
          className="input"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder="0.00"
        />
      </div>
      <div className="field">
        <span className="label" id="settle-method-label">
          Method
        </span>
        <div className="chips" role="group" aria-labelledby="settle-method-label">
          {(['cash', 'upi', 'offline'] as const).map((m) => (
            <button
              key={m}
              className={`chip${method === m ? ' active' : ''}`}
              aria-pressed={method === m}
              onClick={() => setMethod(m)}
            >
              {m === 'cash' ? 'Cash' : m === 'upi' ? 'UPI' : 'Bank / other'}
            </button>
          ))}
        </div>
      </div>

      {payeeVpa && (
        <button
          className="btn btn-success btn-block"
          onClick={payViaUpi}
          style={{ marginBottom: 10 }}
        >
          Pay {memberName(members, to)} via UPI ({payeeVpa})
        </button>
      )}
      {!payeeVpa && currency === 'INR' && to !== from && (
        <p className="faint" style={{ fontSize: 13 }}>
          {memberName(members, to)} hasn&apos;t added a UPI ID — settle in cash, or ask them to add
          one in their profile.
        </p>
      )}

      {suggested && (
        <p className="muted" style={{ fontSize: 13 }}>
          Suggested: {memberName(members, suggested.fromMemberId)} →{' '}
          {memberName(members, suggested.toMemberId)}{' '}
          {formatMoney(suggested.amountMinor, suggested.currency)}
        </p>
      )}
      {error && <p className="error">{error}</p>}
      <button
        className="btn btn-primary btn-block"
        onClick={() => void submit()}
        disabled={saving}
        style={{ marginTop: 6 }}
      >
        {saving ? 'Saving…' : 'Record payment'}
      </button>
    </Modal>
  );
}
