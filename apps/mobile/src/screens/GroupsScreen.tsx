import { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet } from 'react-native';
import { useAuth } from '../auth';
import { api, type Group } from '../api';

export function GroupsScreen({ onOpen }: { onOpen: (groupId: string) => void }) {
  const { token, signOut } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      setGroups(await api.listGroups(token));
      setError(null);
    } catch {
      setError('Could not load groups');
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = async (): Promise<void> => {
    if (!token || !name.trim()) return;
    await api.createGroup(token, name.trim());
    setName('');
    await refresh();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Your groups</Text>
        <Pressable onPress={() => void signOut()}>
          <Text style={styles.link}>Sign out</Text>
        </Pressable>
      </View>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          placeholder="New group name"
          value={name}
          onChangeText={setName}
        />
        <Pressable style={styles.button} onPress={() => void create()}>
          <Text style={styles.buttonText}>Add</Text>
        </Pressable>
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={groups}
        keyExtractor={(g) => g.id}
        ListEmptyComponent={<Text style={styles.muted}>No groups yet.</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.item} onPress={() => onOpen(item.id)}>
            <Text style={styles.itemText}>{item.name}</Text>
            <Text style={styles.muted}>{item.defaultCurrency}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700' },
  link: { color: '#2563EB' },
  row: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12 },
  button: { backgroundColor: '#2563EB', paddingHorizontal: 16, justifyContent: 'center', borderRadius: 8 },
  buttonText: { color: '#fff', fontWeight: '600' },
  item: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderColor: '#F0F1F3' },
  itemText: { fontSize: 16 },
  muted: { color: '#6B7280' },
  error: { color: '#DC2626' },
});
