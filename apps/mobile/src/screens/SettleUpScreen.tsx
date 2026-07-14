import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Linking } from 'react-native';
import { buildUpiPayUri } from '@splitsmart/types';
import { useAuth } from '../auth';
import { api, type GroupDetail, type GroupMember, type Transfer } from '../api';
import { formatMoney } from '../money';

function memberLabel(members: GroupMember[], id: string): string {
  const m = members.find((x) => x.id === id);
  return m ? (m.user?.name ?? m.guestName ?? 'Member') : 'Unknown';
}

/** Parse a decimal major-unit string into integer minor units. */
function toMinor(input: string): number | null {
  const t = input.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const [whole, frac = ''] = t.split('.');
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}

/** A fresh idempotency key per settle attempt (money is sacred — no double-record). */
function newIdempotencyKey(): string {
  return `settle-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function SettleUpScreen({
  group,
  suggested,
  onDone,
  onCancel,
}: {
  group: GroupDetail;
  /** Pre-fills payer/payee/amount from a settlement plan row, if provided. */
  suggested?: Transfer;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { token } = useAuth();
  const members = group.members;
  const [from, setFrom] = useState(suggested?.fromMemberId ?? members[0]?.id ?? '');
  const [to, setTo] = useState(suggested?.toMemberId ?? members[1]?.id ?? '');
  const [amount, setAmount] = useState(suggested ? (suggested.amountMinor / 100).toFixed(2) : '');
  const [method, setMethod] = useState<'cash' | 'offline' | 'upi'>('cash');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const payee = members.find((m) => m.id === to);
  const payeeVpa = payee?.user?.upiId ?? null;

  /** Open the payer's UPI app pre-filled with the payee's VPA and the amount (M5-25). */
  const payViaUpi = async (): Promise<void> => {
    setError(null);
    if (!payeeVpa || !payee) return;
    const amountMinor = toMinor(amount);
    if (amountMinor === null || amountMinor <= 0) return setError('Enter a valid amount first');
    const uri = buildUpiPayUri({
      payeeVpa,
      payeeName: memberLabel(members, payee.id),
      amountPaise: amountMinor,
      note: `SplitSmart · ${group.name}`,
    });
    setMethod('upi');
    try {
      await Linking.openURL(uri);
    } catch {
      setError('No UPI app could be opened on this device');
    }
  };

  const submit = async (): Promise<void> => {
    setError(null);
    if (!token) return;
    if (from === to) return setError('Payer and payee must differ');
    const amountMinor = toMinor(amount);
    if (amountMinor === null || amountMinor <= 0) return setError('Enter a valid amount');

    setSaving(true);
    try {
      await api.recordSettlement(token, group.id, {
        fromMemberId: from,
        toMemberId: to,
        amountMinor,
        currency: suggested?.currency ?? group.defaultCurrency,
        method,
        idempotencyKey: newIdempotencyKey(),
      });
      onDone();
    } catch {
      setError('Could not record the settlement');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={onCancel}>
        <Text style={styles.link}>← Cancel</Text>
      </Pressable>
      <Text style={styles.title}>Record a payment</Text>

      <Text style={styles.section}>Who paid</Text>
      <View style={styles.chips}>
        {members.map((m) => (
          <Pressable
            key={m.id}
            style={[styles.chip, from === m.id && styles.chipActive]}
            onPress={() => setFrom(m.id)}
          >
            <Text style={from === m.id ? styles.chipTextActive : styles.chipText}>
              {memberLabel(members, m.id)}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.section}>Paid to</Text>
      <View style={styles.chips}>
        {members.map((m) => (
          <Pressable
            key={m.id}
            style={[styles.chip, to === m.id && styles.chipActive]}
            onPress={() => setTo(m.id)}
          >
            <Text style={to === m.id ? styles.chipTextActive : styles.chipText}>
              {memberLabel(members, m.id)}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.section}>Amount</Text>
      <TextInput
        style={styles.input}
        keyboardType="decimal-pad"
        placeholder={`Amount (${suggested?.currency ?? group.defaultCurrency})`}
        value={amount}
        onChangeText={setAmount}
      />

      <Text style={styles.section}>Method</Text>
      <View style={styles.chips}>
        {(['cash', 'upi', 'offline'] as const).map((mth) => (
          <Pressable
            key={mth}
            style={[styles.chip, method === mth && styles.chipActive]}
            onPress={() => setMethod(mth)}
          >
            <Text style={method === mth ? styles.chipTextActive : styles.chipText}>
              {mth === 'cash' ? 'Cash' : mth === 'upi' ? 'UPI' : 'Bank / other'}
            </Text>
          </Pressable>
        ))}
      </View>

      {payeeVpa ? (
        <Pressable style={styles.upiButton} onPress={() => void payViaUpi()}>
          <Text style={styles.upiButtonText}>
            Pay {memberLabel(members, to)} via UPI ({payeeVpa})
          </Text>
        </Pressable>
      ) : (
        payee && (
          <Text style={styles.muted}>
            {memberLabel(members, to)} hasn&apos;t added a UPI ID yet — settle in cash or ask them
            to add one in their profile.
          </Text>
        )
      )}

      {suggested && (
        <Text style={styles.muted}>
          Suggested: {memberLabel(members, suggested.fromMemberId)} →{' '}
          {memberLabel(members, suggested.toMemberId)}{' '}
          {formatMoney(suggested.amountMinor, suggested.currency)}
        </Text>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable
        style={[styles.button, saving && styles.buttonDisabled]}
        disabled={saving}
        onPress={() => void submit()}
      >
        <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Record payment'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 10 },
  link: { color: '#2563EB' },
  title: { fontSize: 22, fontWeight: '700' },
  section: { fontSize: 15, fontWeight: '600', marginTop: 6 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chipText: { color: '#111827' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  button: {
    backgroundColor: '#2563EB',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '600' },
  upiButton: {
    borderWidth: 1,
    borderColor: '#059669',
    backgroundColor: '#ECFDF5',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 6,
  },
  upiButtonText: { color: '#059669', fontWeight: '600' },
  muted: { color: '#6B7280' },
  error: { color: '#DC2626' },
});
