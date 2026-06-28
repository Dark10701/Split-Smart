import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';

const API_URL =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? 'http://localhost:3001';

export default function App() {
  const [health, setHealth] = useState<string>('checking…');

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((res) => res.json())
      .then((data: { status: string }) => setHealth(data.status))
      .catch(() => setHealth('unreachable'));
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>SplitSmart</Text>
      <Text>Mobile scaffold (Milestone 0).</Text>
      <Text>
        API health: <Text style={styles.bold}>{health}</Text>
      </Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  title: { fontSize: 24, fontWeight: '700' },
  bold: { fontWeight: '700' },
});
