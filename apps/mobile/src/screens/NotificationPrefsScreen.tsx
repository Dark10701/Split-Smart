import { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, Switch, ScrollView, StyleSheet } from 'react-native';
import { useAuth } from '../auth';
import { api, type NotificationChannel, type NotificationType } from '../api';

const CHANNELS: Array<{ key: NotificationChannel; label: string }> = [
  { key: 'push', label: 'Push' },
  { key: 'email', label: 'Email' },
  { key: 'sms', label: 'SMS' },
  { key: 'in_app', label: 'In-app' },
];

const TYPES: Array<{ key: NotificationType; label: string }> = [
  { key: 'expense_added', label: 'New expense' },
  { key: 'settle_up', label: 'Settle-up request' },
  { key: 'payment_confirmed', label: 'Payment confirmed' },
  { key: 'reminder', label: 'Reminders' },
];

const prefKey = (c: NotificationChannel, t: NotificationType): string => `${c}:${t}`;

/** Notification preferences (M6-14): a per-channel × per-type toggle grid. */
export function NotificationPrefsScreen({ onBack }: { onBack: () => void }) {
  const { token } = useAuth();
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    const prefs = await api.getNotificationPrefs(token);
    const map: Record<string, boolean> = {};
    for (const p of prefs) map[prefKey(p.channel, p.type)] = p.enabled;
    setEnabled(map);
    setReady(true);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (channel: NotificationChannel, type: NotificationType): Promise<void> => {
    if (!token) return;
    const key = prefKey(channel, type);
    const next = !enabled[key];
    setEnabled((prev) => ({ ...prev, [key]: next })); // optimistic
    setSaving(true);
    try {
      const updated = await api.updateNotificationPrefs(token, [{ channel, type, enabled: next }]);
      const map: Record<string, boolean> = {};
      for (const p of updated) map[prefKey(p.channel, p.type)] = p.enabled;
      setEnabled(map);
    } catch {
      setEnabled((prev) => ({ ...prev, [key]: !next })); // revert on failure
    } finally {
      setSaving(false);
    }
  };

  if (!ready) return <Text style={styles.muted}>Loading…</Text>;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable onPress={onBack}>
        <Text style={styles.link}>← Back</Text>
      </Pressable>
      <Text style={styles.title}>Notifications</Text>
      <Text style={styles.muted}>Choose how you want to hear about each kind of update.</Text>

      {TYPES.map((t) => (
        <View key={t.key} style={styles.card}>
          <Text style={styles.typeLabel}>{t.label}</Text>
          {CHANNELS.map((c) => {
            const key = prefKey(c.key, t.key);
            return (
              <View key={c.key} style={styles.row}>
                <Text>{c.label}</Text>
                <Switch
                  value={enabled[key] ?? false}
                  disabled={saving}
                  onValueChange={() => void toggle(c.key, t.key)}
                />
              </View>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  link: { color: '#2563EB' },
  title: { fontSize: 22, fontWeight: '700' },
  muted: { color: '#6B7280' },
  card: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  typeLabel: { fontSize: 16, fontWeight: '600', marginBottom: 6 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
});
