'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
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
import { openUpiPayment } from '../lib/upi';

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
  const [upiOpened, setUpiOpened] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const currency = suggested?.currency ?? group.defaultCurrency;
  // UPI links are INR-only (cu=INR, paise): hide for any non-INR settlement.
  const payeeVpa = currency === 'INR' ? memberUpi(members, to) : null;

  // The upi://pay link for the current payee + amount (null until both valid).
  const amountMinor = toMinor(amount);
  const upiUri =
    payeeVpa && amountMinor !== null && amountMinor > 0
      ? buildUpiPayUri({
          payeeVpa,
          payeeName: memberName(members, to),
          amountPaise: amountMinor,
          note: `SplitSmart · ${group.name}`,
        })
      : null;

  // Desktop can't open upi:// links, so also render the same link as a QR the
  // payer scans with any UPI app on their phone (amount + note pre-filled).
  useEffect(() => {
    let cancelled = false;
    if (!upiUri) {
      setQrDataUrl(null);
      return;
    }
    QRCode.toDataURL(upiUri, { width: 208, margin: 1 })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [upiUri]);

  const payViaUpi = (): void => {
    setError(null);
    if (!payeeVpa || amountMinor === null || amountMinor <= 0)
      return setError('Enter a valid amount first');
    setMethod('upi');
    // Generic upi:// deep link — the OS opens GPay/PhonePe/etc. or shows its
    // chooser. On desktop (no handler) it's a no-op; the QR and copy button
    // below cover that case.
    openUpiPayment({
      payeeVpa,
      payeeName: memberName(members, to),
      amountPaise: amountMinor,
      note: `SplitSmart · ${group.name}`,
    });
    setUpiOpened(true);
  };

  const copyVpa = async (): Promise<void> => {
    if (!payeeVpa) return;
    try {
      await navigator.clipboard.writeText(payeeVpa);
      setCopied(true);
      setMethod('upi');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy — select the UPI ID manually');
    }
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
        <div
          className="card card-pad"
          style={{ background: 'var(--positive-soft)', border: 'none', marginBottom: 12 }}
        >
          <div className="between" style={{ marginBottom: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                Pay {memberName(members, to)} via UPI
              </div>
              <div className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>
                {payeeVpa}
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => void copyVpa()}>
              {copied ? 'Copied ✓' : 'Copy ID'}
            </button>
          </div>
          <button className="btn btn-success btn-block" onClick={payViaUpi}>
            Open UPI app{amountMinor ? ` — pay ${formatMoney(amountMinor, currency)}` : ''}
          </button>
          {qrDataUrl && (
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <div
                style={{
                  display: 'inline-block',
                  padding: 8,
                  background: '#fff',
                  borderRadius: 12,
                }}
              >
                {/* Data-URL QR — next/image adds nothing for an inline data URI. */}
                <img
                  src={qrDataUrl}
                  width={176}
                  height={176}
                  alt={`UPI payment QR for ${payeeVpa}`}
                  style={{ display: 'block' }}
                />
              </div>
              <div className="faint" style={{ fontSize: 12, marginTop: 6 }}>
                On a computer? Scan with any UPI app — amount &amp; note are pre-filled.
              </div>
            </div>
          )}
        </div>
      )}
      {upiOpened && (
        <p className="success-text" style={{ marginTop: 0 }}>
          Opened your UPI app — once you&apos;ve paid, tap “Record payment” below to log it.
        </p>
      )}
      {!payeeVpa && currency === 'INR' && to !== from && (
        <p className="faint" style={{ fontSize: 13 }}>
          {memberName(members, to)} hasn&apos;t added a UPI ID — settle in cash, or ask them to add
          one in their profile.
        </p>
      )}

      {suggested && (
        <div
          className="card card-pad"
          style={{
            background: 'var(--primary-soft)',
            border: 'none',
            boxShadow: 'none',
            marginBottom: 12,
          }}
        >
          <div className="faint" style={{ fontSize: 12 }}>
            Suggested
          </div>
          <div style={{ fontWeight: 600 }}>
            {memberName(members, suggested.fromMemberId)} →{' '}
            {memberName(members, suggested.toMemberId)}{' '}
            <span className="amount">{formatMoney(suggested.amountMinor, suggested.currency)}</span>
          </div>
        </div>
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
