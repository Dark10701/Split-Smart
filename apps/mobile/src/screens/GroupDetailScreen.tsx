import { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, FlatList, Share, StyleSheet } from 'react-native';
import { useAuth } from '../auth';
import {
  api,
  API_URL,
  type GroupDetail,
  type GroupMember,
  type Expense,
  type GroupBalances,
} from '../api';
import { formatMoney } from '../money';
import { useGroupRealtime } from '../realtime';
import { AddExpenseScreen } from './AddExpenseScreen';

type Tab = 'expenses' | 'balances';

function memberName(members: GroupMember[], id: string): string {
  const m = members.find((x) => x.id === id);
  return m ? (m.guestName ?? (m.userId ? 'Member' : 'Guest')) : 'Unknown';
}

export function GroupDetailScreen({ groupId, onBack }: { groupId: string; onBack: () => void }) {
  const { token } = useAuth();
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balances, setBalances] = useState<GroupBalances | null>(null);
  const [tab, setTab] = useState<Tab>('expenses');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    const [g, page, bal] = await Promise.all([
      api.getGroup(token, groupId),
      api.listExpenses(token, groupId),
      api.getBalances(token, groupId),
    ]);
    setGroup(g);
    setExpenses(page.items);
    setBalances(bal);
  }, [token, groupId]);

  useEffect(() => {
    void load();
  }, [load]);

  // M2-24: refetch whenever the server reports a change to this group.
  const onEvent = useCallback(() => void load(), [load]);
  useGroupRealtime(groupId, onEvent);

  const invite = async (): Promise<void> => {
    if (!token) return;
    const { token: inviteToken } = await api.createInvite(token, groupId);
    await Share.share({ message: `Join my SplitSmart group: ${API_URL}/invite/${inviteToken}` });
  };

  const removeExpense = async (id: string): Promise<void> => {
    if (!token) return;
    await api.deleteExpense(token, groupId, id);
    await load();
  };

  if (!group) return <Text style={styles.muted}>Loading…</Text>;

  if (adding) {
    return (
      <AddExpenseScreen
        group={group}
        onCancel={() => setAdding(false)}
        onDone={() => {
          setAdding(false);
          void load();
        }}
      />
    );
  }

  return (
    <View style={styles.container}>
      <Pressable onPress={onBack}>
        <Text style={styles.link}>← Groups</Text>
      </Pressable>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{group.name}</Text>
        <Pressable onPress={() => void invite()}>
          <Text style={styles.link}>Invite</Text>
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {(['expenses', 'balances'] as Tab[]).map((t) => (
          <Pressable key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={tab === t ? styles.tabTextActive : styles.tabText}>
              {t === 'expenses' ? 'Expenses' : 'Balances'}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'expenses' ? (
        <FlatList
          data={expenses}
          keyExtractor={(e) => e.id}
          ListEmptyComponent={<Text style={styles.muted}>No expenses yet.</Text>}
          renderItem={({ item }) => (
            <View style={styles.expenseItem}>
              <View style={styles.expenseMain}>
                <Text style={styles.expenseDesc}>{item.description}</Text>
                <Text style={styles.muted}>
                  {memberName(group.members, item.payerMemberId)} paid ·{' '}
                  {item.splitType} split
                </Text>
              </View>
              <View style={styles.expenseRight}>
                <Text style={styles.amount}>{formatMoney(item.amountMinor, item.currency)}</Text>
                <Pressable onPress={() => void removeExpense(item.id)}>
                  <Text style={styles.delete}>Delete</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      ) : (
        <BalancesView group={group} balances={balances} />
      )}

      <Pressable style={styles.fab} onPress={() => setAdding(true)}>
        <Text style={styles.fabText}>+ Add expense</Text>
      </Pressable>
    </View>
  );
}

function BalancesView({
  group,
  balances,
}: {
  group: GroupDetail;
  balances: GroupBalances | null;
}) {
  if (!balances) return <Text style={styles.muted}>Loading balances…</Text>;
  const settlements = balances.settlements;
  if (settlements.length === 0) {
    return <Text style={styles.muted}>All settled up 🎉</Text>;
  }
  return (
    <FlatList
      data={settlements}
      keyExtractor={(t, i) => `${t.fromMemberId}-${t.toMemberId}-${i}`}
      renderItem={({ item }) => (
        <View style={styles.settleRow}>
          <Text>
            <Text style={styles.bold}>{memberName(group.members, item.fromMemberId)}</Text> owes{' '}
            <Text style={styles.bold}>{memberName(group.members, item.toMemberId)}</Text>
          </Text>
          <Text style={styles.amount}>{formatMoney(item.amountMinor, item.currency)}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  link: { color: '#2563EB' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700' },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#F3F4F6' },
  tabActive: { backgroundColor: '#2563EB' },
  tabText: { color: '#111827' },
  tabTextActive: { color: '#fff', fontWeight: '600' },
  expenseItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#F0F1F3' },
  expenseMain: { flex: 1, gap: 2 },
  expenseDesc: { fontSize: 16, fontWeight: '500' },
  expenseRight: { alignItems: 'flex-end', gap: 2 },
  amount: { fontSize: 16, fontWeight: '600' },
  delete: { color: '#DC2626', fontSize: 12 },
  settleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderColor: '#F0F1F3' },
  bold: { fontWeight: '700' },
  fab: { backgroundColor: '#2563EB', padding: 16, borderRadius: 8, alignItems: 'center' },
  fabText: { color: '#fff', fontWeight: '700' },
  muted: { color: '#6B7280' },
});
