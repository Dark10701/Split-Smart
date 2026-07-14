import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useAuth } from '../auth';
import {
  api,
  type GroupDetail,
  type GroupMember,
  type SplitMethod,
  type SplitPayload,
} from '../api';

const METHODS: Array<{ key: SplitMethod; label: string }> = [
  { key: 'equal', label: 'Equal' },
  { key: 'exact', label: 'Exact' },
  { key: 'percentage', label: 'Percent' },
  { key: 'shares', label: 'Shares' },
  { key: 'itemized', label: 'Items' },
];

/** Draft line item while editing an itemized split. */
interface ItemDraft {
  description: string;
  amount: string;
  participants: Set<string>;
}

function memberLabel(m: GroupMember): string {
  return m.user?.name ?? m.guestName ?? 'Member';
}

/** Parse a decimal major-unit string ("12.34") into integer minor units. */
function toMinor(input: string): number | null {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [whole, frac = ''] = trimmed.split('.');
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}

export function AddExpenseScreen({
  group,
  onDone,
  onCancel,
}: {
  group: GroupDetail;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { token } = useAuth();
  const members = group.members;
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [payerMemberId, setPayerMemberId] = useState(members[0]?.id ?? '');
  const [method, setMethod] = useState<SplitMethod>('equal');
  const [participants, setParticipants] = useState<Set<string>>(new Set(members.map((m) => m.id)));
  // Per-member raw input for exact (minor via major string) / percentage (%) / shares (units).
  const [values, setValues] = useState<Record<string, string>>({});
  // Line items while the "Items" method is selected.
  const [items, setItems] = useState<ItemDraft[]>([
    { description: '', amount: '', participants: new Set(members.map((m) => m.id)) },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const toggle = (id: string): void => {
    setParticipants((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const setValue = (id: string, v: string): void => setValues((prev) => ({ ...prev, [id]: v }));

  const updateItem = (index: number, patch: Partial<ItemDraft>): void =>
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));

  const toggleItemParticipant = (index: number, memberId: string): void =>
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== index) return it;
        const next = new Set(it.participants);
        if (next.has(memberId)) next.delete(memberId);
        else next.add(memberId);
        return { ...it, participants: next };
      }),
    );

  const addItem = (): void =>
    setItems((prev) => [
      ...prev,
      { description: '', amount: '', participants: new Set(members.map((m) => m.id)) },
    ]);

  const removeItem = (index: number): void =>
    setItems((prev) => prev.filter((_, i) => i !== index));

  /** Sum of the item amounts entered so far, in minor units (null if any is invalid). */
  const itemsTotalMinor = (): number | null => {
    let sum = 0;
    for (const it of items) {
      const minor = toMinor(it.amount);
      if (minor === null) return null;
      sum += minor;
    }
    return sum;
  };

  const buildSplit = (amountMinor: number): SplitPayload | string => {
    if (method === 'itemized') {
      const built = [];
      for (const it of items) {
        if (!it.description.trim()) return 'Every item needs a description';
        const minor = toMinor(it.amount);
        if (minor === null || minor <= 0) return 'Every item needs a valid amount';
        if (it.participants.size === 0) return 'Every item needs at least one participant';
        built.push({
          description: it.description.trim(),
          amountMinor: minor,
          participantMemberIds: [...it.participants],
        });
      }
      const sum = built.reduce((s, i) => s + i.amountMinor, 0);
      if (sum !== amountMinor)
        return `Items must add up to the total (items ${(sum / 100).toFixed(2)} vs total ${(amountMinor / 100).toFixed(2)})`;
      return { type: 'itemized', items: built };
    }

    const chosen = members.filter((m) => participants.has(m.id));
    if (chosen.length === 0) return 'Select at least one participant';

    if (method === 'equal') {
      return { type: 'equal', participantMemberIds: chosen.map((m) => m.id) };
    }
    if (method === 'exact') {
      const shares = chosen.map((m) => ({
        memberId: m.id,
        amountMinor: toMinor(values[m.id] ?? '') ?? -1,
      }));
      if (shares.some((s) => s.amountMinor < 0)) return 'Enter a valid amount for each participant';
      const sum = shares.reduce((s, x) => s + x.amountMinor, 0);
      if (sum !== amountMinor)
        return `Exact amounts must sum to the total (${sum} vs ${amountMinor})`;
      return { type: 'exact', shares };
    }
    if (method === 'percentage') {
      const shares = chosen.map((m) => {
        const pct = Number(values[m.id]);
        return { memberId: m.id, percentBps: Number.isFinite(pct) ? Math.round(pct * 100) : -1 };
      });
      if (shares.some((s) => s.percentBps < 0)) return 'Enter a percentage for each participant';
      const sum = shares.reduce((s, x) => s + x.percentBps, 0);
      if (sum !== 10000) return 'Percentages must add up to 100%';
      return { type: 'percentage', shares };
    }
    // shares
    const shares = chosen.map((m) => ({ memberId: m.id, units: Number(values[m.id] ?? '1') }));
    if (shares.some((s) => !Number.isInteger(s.units) || s.units <= 0))
      return 'Share units must be positive whole numbers';
    return { type: 'shares', shares };
  };

  const submit = async (): Promise<void> => {
    setError(null);
    if (!token) return;
    if (!description.trim()) return setError('Add a description');
    const amountMinor = toMinor(amount);
    if (amountMinor === null || amountMinor <= 0) return setError('Enter a valid amount');
    if (!payerMemberId) return setError('Choose who paid');

    const split = buildSplit(amountMinor);
    if (typeof split === 'string') return setError(split);

    setSaving(true);
    try {
      await api.createExpense(token, group.id, {
        description: description.trim(),
        amountMinor,
        currency: group.defaultCurrency,
        payerMemberId,
        occurredAt: new Date().toISOString(),
        split,
      });
      onDone();
    } catch {
      setError('Could not save the expense');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable onPress={onCancel}>
        <Text style={styles.link}>← Cancel</Text>
      </Pressable>
      <Text style={styles.title}>Add expense</Text>

      <TextInput
        style={styles.input}
        placeholder="Description (e.g. Dinner)"
        value={description}
        onChangeText={setDescription}
      />
      <TextInput
        style={styles.input}
        placeholder={`Amount (${group.defaultCurrency})`}
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
      />

      <Text style={styles.section}>Paid by</Text>
      <View style={styles.chips}>
        {members.map((m) => (
          <Pressable
            key={m.id}
            style={[styles.chip, payerMemberId === m.id && styles.chipActive]}
            onPress={() => setPayerMemberId(m.id)}
          >
            <Text style={payerMemberId === m.id ? styles.chipTextActive : styles.chipText}>
              {memberLabel(m)}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.section}>Split</Text>
      <View style={styles.chips}>
        {METHODS.map((mth) => (
          <Pressable
            key={mth.key}
            style={[styles.chip, method === mth.key && styles.chipActive]}
            onPress={() => setMethod(mth.key)}
          >
            <Text style={method === mth.key ? styles.chipTextActive : styles.chipText}>
              {mth.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {method !== 'itemized' ? (
        <>
          <Text style={styles.section}>Participants</Text>
          {members.map((m) => {
            const on = participants.has(m.id);
            return (
              <View key={m.id} style={styles.participantRow}>
                <Pressable style={styles.participantToggle} onPress={() => toggle(m.id)}>
                  <Text style={styles.checkbox}>{on ? '☑' : '☐'}</Text>
                  <Text>{memberLabel(m)}</Text>
                </Pressable>
                {on && method !== 'equal' && (
                  <TextInput
                    style={styles.smallInput}
                    keyboardType={method === 'shares' ? 'number-pad' : 'decimal-pad'}
                    placeholder={
                      method === 'exact' ? '0.00' : method === 'percentage' ? '%' : 'units'
                    }
                    value={values[m.id] ?? ''}
                    onChangeText={(v) => setValue(m.id, v)}
                  />
                )}
              </View>
            );
          })}
        </>
      ) : (
        <>
          <Text style={styles.section}>Items</Text>
          {items.map((it, i) => (
            <View key={i} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <TextInput
                  style={[styles.input, styles.itemDescription]}
                  placeholder={`Item ${i + 1} (e.g. Starter)`}
                  value={it.description}
                  onChangeText={(v) => updateItem(i, { description: v })}
                />
                <TextInput
                  style={styles.smallInput}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  value={it.amount}
                  onChangeText={(v) => updateItem(i, { amount: v })}
                />
              </View>
              <View style={styles.chips}>
                {members.map((m) => (
                  <Pressable
                    key={m.id}
                    style={[styles.chip, it.participants.has(m.id) && styles.chipActive]}
                    onPress={() => toggleItemParticipant(i, m.id)}
                  >
                    <Text
                      style={it.participants.has(m.id) ? styles.chipTextActive : styles.chipText}
                    >
                      {memberLabel(m)}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {items.length > 1 && (
                <Pressable onPress={() => removeItem(i)}>
                  <Text style={styles.delete}>Remove item</Text>
                </Pressable>
              )}
            </View>
          ))}
          <Pressable style={styles.addItem} onPress={addItem}>
            <Text style={styles.link}>+ Add item</Text>
          </Pressable>
          {(() => {
            const sum = itemsTotalMinor();
            const total = toMinor(amount);
            if (sum === null || total === null) return null;
            const ok = sum === total;
            return (
              <Text style={ok ? styles.success : styles.error}>
                Items: {(sum / 100).toFixed(2)} / {(total / 100).toFixed(2)}
                {ok ? ' ✓' : ' — must match the total'}
              </Text>
            );
          })()}
        </>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable
        style={[styles.button, saving && styles.buttonDisabled]}
        disabled={saving}
        onPress={() => void submit()}
      >
        <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save expense'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  link: { color: '#2563EB' },
  title: { fontSize: 22, fontWeight: '700' },
  section: { fontSize: 16, fontWeight: '600', marginTop: 8 },
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
  participantRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  participantToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  checkbox: { fontSize: 18 },
  smallInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 8,
    width: 90,
    textAlign: 'right',
  },
  itemCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 10,
    gap: 8,
  },
  itemHeader: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  itemDescription: { flex: 1 },
  addItem: { paddingVertical: 4 },
  delete: { color: '#DC2626', fontSize: 12 },
  success: { color: '#059669' },
  button: {
    backgroundColor: '#2563EB',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '600' },
  error: { color: '#DC2626' },
});
