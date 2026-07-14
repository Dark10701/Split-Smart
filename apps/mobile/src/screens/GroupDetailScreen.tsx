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
  type Transfer,
  type ActivityEntry,
} from '../api';
import { formatMoney } from '../money';
import { useGroupRealtime } from '../realtime';
import { AddExpenseScreen } from './AddExpenseScreen';
import { SettleUpScreen } from './SettleUpScreen';
import { CommentsScreen } from './CommentsScreen';

type Tab = 'expenses' | 'balances' | 'activity';

function memberName(members: GroupMember[], id: string): string {
  const m = members.find((x) => x.id === id);
  return m ? (m.guestName ?? (m.userId ? 'Member' : 'Guest')) : 'Unknown';
}

function describeActivity(a: ActivityEntry): string {
  const noun = a.entityType === 'payment' ? 'settlement' : a.entityType;
  return `${a.action} ${noun}`;
}

export function GroupDetailScreen({ groupId, onBack }: { groupId: string; onBack: () => void }) {
  const { token } = useAuth();
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balances, setBalances] = useState<GroupBalances | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [tab, setTab] = useState<Tab>('expenses');
  const [adding, setAdding] = useState(false);
  const [settling, setSettling] = useState<Transfer | 'blank' | null>(null);
  const [commentingOn, setCommentingOn] = useState<Expense | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    const [g, page, bal, act] = await Promise.all([
      api.getGroup(token, groupId),
      api.listExpenses(token, groupId),
      api.getBalances(token, groupId),
      api.listActivity(token, groupId),
    ]);
    setGroup(g);
    setExpenses(page.items);
    setBalances(bal);
    setActivity(act.items);
  }, [token, groupId]);

  useEffect(() => {
    void load();
  }, [load]);

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

  if (settling) {
    return (
      <SettleUpScreen
        group={group}
        suggested={settling === 'blank' ? undefined : settling}
        onCancel={() => setSettling(null)}
        onDone={() => {
          setSettling(null);
          void load();
        }}
      />
    );
  }

  if (commentingOn) {
    return (
      <CommentsScreen
        groupId={groupId}
        expense={commentingOn}
        onBack={() => setCommentingOn(null)}
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
        {(['expenses', 'balances', 'activity'] as Tab[]).map((t) => (
          <Pressable
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={tab === t ? styles.tabTextActive : styles.tabText}>
              {t === 'expenses' ? 'Expenses' : t === 'balances' ? 'Balances' : 'Activity'}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'expenses' && (
        <FlatList
          data={expenses}
          keyExtractor={(e) => e.id}
          ListEmptyComponent={<Text style={styles.muted}>No expenses yet.</Text>}
          renderItem={({ item }) => (
            <Pressable style={styles.expenseItem} onPress={() => setCommentingOn(item)}>
              <View style={styles.expenseMain}>
                <Text style={styles.expenseDesc}>{item.description}</Text>
                <Text style={styles.muted}>
                  {memberName(group.members, item.payerMemberId)} paid · {item.splitType} split
                </Text>
              </View>
              <View style={styles.expenseRight}>
                <Text style={styles.amount}>{formatMoney(item.amountMinor, item.currency)}</Text>
                <Pressable onPress={() => void removeExpense(item.id)}>
                  <Text style={styles.delete}>Delete</Text>
                </Pressable>
              </View>
            </Pressable>
          )}
        />
      )}

      {tab === 'balances' && (
        <BalancesView group={group} balances={balances} onSettle={(t) => setSettling(t)} />
      )}

      {tab === 'activity' && (
        <FlatList
          data={activity}
          keyExtractor={(a) => a.id}
          ListEmptyComponent={<Text style={styles.muted}>No activity yet.</Text>}
          renderItem={({ item }) => (
            <View style={styles.activityRow}>
              <Text style={styles.activityText}>{describeActivity(item)}</Text>
              <Text style={styles.time}>{new Date(item.createdAt).toLocaleString()}</Text>
            </View>
          )}
        />
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
  onSettle,
}: {
  group: GroupDetail;
  balances: GroupBalances | null;
  onSettle: (t: Transfer | 'blank') => void;
}) {
  if (!balances) return <Text style={styles.muted}>Loading balances…</Text>;
  const settlements = balances.settlements;
  if (settlements.length === 0) {
    return (
      <View style={{ gap: 12 }}>
        <Text style={styles.muted}>All settled up 🎉</Text>
        <Pressable style={styles.secondaryButton} onPress={() => onSettle('blank')}>
          <Text style={styles.secondaryText}>Record a payment</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <FlatList
      data={settlements}
      keyExtractor={(t, i) => `${t.fromMemberId}-${t.toMemberId}-${i}`}
      renderItem={({ item }) => (
        <View style={styles.settleRow}>
          <View style={{ flex: 1 }}>
            <Text>
              <Text style={styles.bold}>{memberName(group.members, item.fromMemberId)}</Text> owes{' '}
              <Text style={styles.bold}>{memberName(group.members, item.toMemberId)}</Text>
            </Text>
            <Text style={styles.amount}>{formatMoney(item.amountMinor, item.currency)}</Text>
          </View>
          <Pressable style={styles.secondaryButton} onPress={() => onSettle(item)}>
            <Text style={styles.secondaryText}>Settle</Text>
          </Pressable>
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
  tab: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: '#F3F4F6' },
  tabActive: { backgroundColor: '#2563EB' },
  tabText: { color: '#111827' },
  tabTextActive: { color: '#fff', fontWeight: '600' },
  expenseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#F0F1F3',
  },
  expenseMain: { flex: 1, gap: 2 },
  expenseDesc: { fontSize: 16, fontWeight: '500' },
  expenseRight: { alignItems: 'flex-end', gap: 2 },
  amount: { fontSize: 16, fontWeight: '600' },
  delete: { color: '#DC2626', fontSize: 12 },
  settleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: '#F0F1F3',
    gap: 12,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  secondaryText: { color: '#2563EB', fontWeight: '600' },
  bold: { fontWeight: '700' },
  activityRow: { paddingVertical: 12, borderBottomWidth: 1, borderColor: '#F0F1F3', gap: 2 },
  activityText: { fontSize: 15, textTransform: 'capitalize' },
  time: { color: '#9CA3AF', fontSize: 11 },
  fab: { backgroundColor: '#2563EB', padding: 16, borderRadius: 8, alignItems: 'center' },
  fabText: { color: '#fff', fontWeight: '700' },
  muted: { color: '#6B7280' },
});
