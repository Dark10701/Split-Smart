import { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet } from 'react-native';
import { useAuth } from '../auth';
import { api, type Comment, type Expense } from '../api';
import { formatMoney } from '../money';

export function CommentsScreen({
  groupId,
  expense,
  onBack,
}: {
  groupId: string;
  expense: Expense;
  onBack: () => void;
}) {
  const { token } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setComments(await api.listComments(token, groupId, expense.id));
    } catch {
      setError('Could not load comments');
    }
  }, [token, groupId, expense.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const send = async (): Promise<void> => {
    if (!token || !body.trim()) return;
    try {
      await api.addComment(token, groupId, expense.id, body.trim());
      setBody('');
      await load();
    } catch {
      setError('Could not post comment');
    }
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={onBack}>
        <Text style={styles.link}>← Back</Text>
      </Pressable>
      <Text style={styles.title}>{expense.description}</Text>
      <Text style={styles.muted}>{formatMoney(expense.amountMinor, expense.currency)}</Text>

      <FlatList
        style={styles.list}
        data={comments}
        keyExtractor={(c) => c.id}
        ListEmptyComponent={<Text style={styles.muted}>No comments yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.comment}>
            <Text>{item.body}</Text>
            <Text style={styles.time}>{new Date(item.createdAt).toLocaleString()}</Text>
          </View>
        )}
      />

      {error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          placeholder="Add a comment"
          value={body}
          onChangeText={setBody}
        />
        <Pressable style={styles.button} onPress={() => void send()}>
          <Text style={styles.buttonText}>Send</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8 },
  link: { color: '#2563EB' },
  title: { fontSize: 20, fontWeight: '700' },
  list: { flex: 1, marginTop: 8 },
  comment: { paddingVertical: 10, borderBottomWidth: 1, borderColor: '#F0F1F3', gap: 2 },
  time: { color: '#9CA3AF', fontSize: 11 },
  row: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12 },
  button: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 8,
  },
  buttonText: { color: '#fff', fontWeight: '600' },
  muted: { color: '#6B7280' },
  error: { color: '#DC2626' },
});
