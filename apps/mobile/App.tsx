import { useState } from 'react';
import { SafeAreaView, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/auth';
import { LoginScreen } from './src/screens/LoginScreen';
import { GroupsScreen } from './src/screens/GroupsScreen';
import { GroupDetailScreen } from './src/screens/GroupDetailScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { NotificationPrefsScreen } from './src/screens/NotificationPrefsScreen';

function Root() {
  const { token, ready } = useAuth();
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const [screen, setScreen] = useState<'groups' | 'profile' | 'notifications'>('groups');

  if (!ready) return <ActivityIndicator style={styles.center} />;
  if (!token) return <LoginScreen />;
  if (screen === 'notifications') {
    return <NotificationPrefsScreen onBack={() => setScreen('profile')} />;
  }
  if (screen === 'profile') {
    return (
      <ProfileScreen
        onBack={() => setScreen('groups')}
        onOpenNotifications={() => setScreen('notifications')}
      />
    );
  }
  if (openGroupId) {
    return <GroupDetailScreen groupId={openGroupId} onBack={() => setOpenGroupId(null)} />;
  }
  return <GroupsScreen onOpen={setOpenGroupId} onOpenProfile={() => setScreen('profile')} />;
}

export default function App() {
  return (
    <AuthProvider>
      <SafeAreaView style={styles.safe}>
        <Root />
        <StatusBar style="auto" />
      </SafeAreaView>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1 },
});
