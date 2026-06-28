import { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, FlatList, Share, StyleSheet } from 'react-native';
import { useAuth } from '../auth';
import { api, API_URL, type GroupDetail } from '../api';

export function GroupDetailScreen({ groupId, onBack }: { groupId: string; onBack: () => void }) {
  const { token } = useAuth();
  const [group, setGroup] = useState<GroupDetail | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setGroup(await api.getGroup(token, groupId));
  }, [token, groupId]);

  useEffect(() => {
    void load();
  }, [load]);

  const invite = async (): Promise<void> => {
    if (!token) return;
    const { token: inviteToken } = await api.createInvite(token, groupId);
    await Share.share({ message: `Join my SplitSmart group: ${API_URL}/invite/${inviteToken}` });
  };

  if (!group) return <Text style={styles.muted}>Loading…</Text>;

  return (
    <View style={styles.container}>
      <Pressable onPress={onBack}>
        <Text style={styles.link}>← Groups</Text>
      </Pressable>
      <Text style={styles.title}>{group.name}</Text>
      <Pressable style={styles.button} onPress={() => void invite()}>
        <Text style={styles.buttonText}>Invite — share link</Text>
      </Pressable>
      <Text style={styles.section}>Members</Text>
      <FlatList
        data={group.members}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text>{item.guestName ?? item.userId ?? 'Member'}</Text>
            <Text style={styles.muted}>{item.role}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  link: { color: '#2563EB' },
  title: { fontSize: 22, fontWeight: '700' },
  section: { fontSize: 16, fontWeight: '600', marginTop: 8 },
  button: { backgroundColor: '#2563EB', padding: 12, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
  item: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#F0F1F3' },
  muted: { color: '#6B7280' },
});
