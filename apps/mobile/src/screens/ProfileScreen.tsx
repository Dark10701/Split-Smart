import { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useAuth } from '../auth';
import { api, ApiError, type Me } from '../api';

/**
 * Profile screen (M5-24): name + UPI ID. The UPI field accepts a typed VPA
 * (maya@okhdfcbank) or a pasted `upi://` link / UPI QR contents — the server
 * extracts and stores the normalized VPA either way.
 */
export function ProfileScreen({
  onBack,
  onOpenNotifications,
}: {
  onBack: () => void;
  onOpenNotifications: () => void;
}) {
  const { token } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [name, setName] = useState('');
  const [upiInput, setUpiInput] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    const profile = await api.me(token);
    setMe(profile);
    setName(profile.name);
    setUpiInput(profile.upiId ?? '');
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (): Promise<void> => {
    setError(null);
    setMessage(null);
    if (!token || !me) return;
    const body: { name?: string; upiId?: string | null } = {};
    if (name.trim() && name.trim() !== me.name) body.name = name.trim();
    const upiTrimmed = upiInput.trim();
    if (upiTrimmed !== (me.upiId ?? '')) body.upiId = upiTrimmed === '' ? null : upiTrimmed;
    if (Object.keys(body).length === 0) return setMessage('Nothing to save');

    setSaving(true);
    try {
      const updated = await api.updateMe(token, body);
      setMe(updated);
      setUpiInput(updated.upiId ?? '');
      setMessage(
        body.upiId === null
          ? 'UPI ID removed'
          : updated.upiId
            ? `Saved — you can now be paid at ${updated.upiId}`
            : 'Saved',
      );
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 400
          ? 'That does not look like a valid UPI ID or UPI link'
          : 'Could not save your profile',
      );
    } finally {
      setSaving(false);
    }
  };

  if (!me) return <Text style={styles.muted}>Loading…</Text>;

  return (
    <View style={styles.container}>
      <Pressable onPress={onBack}>
        <Text style={styles.link}>← Back</Text>
      </Pressable>
      <Text style={styles.title}>Your profile</Text>
      <Text style={styles.muted}>{me.email}</Text>

      <Text style={styles.section}>Name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} />

      <Text style={styles.section}>UPI ID</Text>
      <Text style={styles.hint}>
        Type your UPI ID (like maya@okhdfcbank) or paste a UPI payment link / your UPI QR&apos;s
        contents. Group members use this to pay you directly.
      </Text>
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="yourname@bank or upi://pay?pa=…"
        value={upiInput}
        onChangeText={setUpiInput}
      />

      {error && <Text style={styles.error}>{error}</Text>}
      {message && <Text style={styles.success}>{message}</Text>}
      <Pressable
        style={[styles.button, saving && styles.buttonDisabled]}
        disabled={saving}
        onPress={() => void save()}
      >
        <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save'}</Text>
      </Pressable>

      <Pressable style={styles.linkRow} onPress={onOpenNotifications}>
        <Text style={styles.link}>Notification settings →</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 10 },
  link: { color: '#2563EB' },
  title: { fontSize: 22, fontWeight: '700' },
  section: { fontSize: 15, fontWeight: '600', marginTop: 8 },
  hint: { color: '#6B7280', fontSize: 13 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12 },
  button: {
    backgroundColor: '#2563EB',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '600' },
  muted: { color: '#6B7280' },
  error: { color: '#DC2626' },
  success: { color: '#059669' },
  linkRow: { marginTop: 18, alignItems: 'center' },
});
