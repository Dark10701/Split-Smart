import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useAuth } from '../auth';

/**
 * Dev sign-in. Production builds authenticate with Google/Apple/email through
 * the OIDC provider (expo-auth-session / expo-apple-authentication) and pass
 * the resulting ID token to `signIn`. The button below stands in for that.
 */
export function LoginScreen() {
  const { signIn } = useAuth();
  const [token, setToken] = useState('');

  return (
    <View style={styles.container}>
      <Text style={styles.title}>SplitSmart</Text>
      <Text style={styles.body}>
        Sign in to track and settle shared expenses. Production builds use Google, Apple, or email;
        for now, paste a valid bearer token.
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Bearer token"
        autoCapitalize="none"
        autoCorrect={false}
        value={token}
        onChangeText={setToken}
      />
      <Pressable
        style={[styles.button, !token && styles.buttonDisabled]}
        disabled={!token}
        onPress={() => void signIn(token.trim())}
      >
        <Text style={styles.buttonText}>Continue</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: '700' },
  body: { color: '#6B7280' },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12 },
  button: { backgroundColor: '#2563EB', padding: 14, borderRadius: 8, alignItems: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '600' },
});
