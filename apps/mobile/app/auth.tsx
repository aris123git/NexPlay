import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { api, type Session } from '../src/lib/api';
import { saveSession } from '../src/lib/session';
import { colors } from '../src/theme';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError('');
    try {
      const path = mode === 'login' ? '/auth/login' : '/auth/register';
      const body =
        mode === 'login'
          ? { email, password }
          : { email, password, username: username || email.split('@')[0] };
      const res = await api<{
        accessToken: string;
        refreshToken: string;
        user: Session['user'];
      }>(path, { method: 'POST', body: JSON.stringify(body) });
      await saveSession({
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        user: res.user,
      });
      router.replace('/');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>{mode === 'login' ? 'Connexion' : 'Créer un compte'}</Text>
      {mode === 'register' ? (
        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          value={username}
          onChangeText={setUsername}
        />
      ) : null}
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Mot de passe"
        placeholderTextColor={colors.muted}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.primary} onPress={submit} disabled={busy}>
        <Text style={styles.primaryText}>{busy ? '…' : 'Continuer'}</Text>
      </Pressable>
      <Pressable onPress={() => setMode(mode === 'login' ? 'register' : 'login')}>
        <Text style={styles.link}>
          {mode === 'login' ? 'Créer un compte' : 'Déjà un compte ?'}
        </Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: colors.bg, gap: 12, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '800', color: colors.cream, marginBottom: 8 },
  input: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    color: colors.cream,
    borderWidth: 1,
    borderColor: 'rgba(243,235,224,0.12)',
  },
  primary: {
    backgroundColor: colors.mint,
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryText: { color: '#042016', fontWeight: '700', fontSize: 16 },
  link: { color: colors.gold, textAlign: 'center', marginTop: 12 },
  error: { color: '#e85d4c' },
});
