import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Link, router } from 'expo-router';
import { api, type Session } from '../src/lib/api';
import { clearSession, loadSession } from '../src/lib/session';
import { colors } from '../src/theme';

export default function HomeScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const s = await loadSession();
      setSession(s);
      setLoading(false);
      try {
        const stats = await api<{ onlineCount: number }>('/api/presence/stats');
        setOnline(stats.onlineCount);
      } catch {
        /* offline ok */
      }
    })();
  }, []);

  async function logout() {
    await clearSession();
    setSession(null);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.mint} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>NexPlay</Text>
      <Text style={styles.lede}>Burkina Faso → Monde · V3.5 Mobile</Text>
      {online !== null ? (
        <Text style={styles.muted}>● {online} en ligne</Text>
      ) : null}

      {session ? (
        <>
          <Text style={styles.user}>
            {session.user.nexplayTag ?? session.user.username}
          </Text>
          <Text style={styles.muted}>{session.user.nexplayId}</Text>
          <Pressable style={styles.primary} onPress={() => router.push('/play')}>
            <Text style={styles.primaryText}>Jouer</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={logout}>
            <Text style={styles.secondaryText}>Déconnexion</Text>
          </Pressable>
        </>
      ) : (
        <Link href="/auth" asChild>
          <Pressable style={styles.primary}>
            <Text style={styles.primaryText}>Connexion</Text>
          </Pressable>
        </Link>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  container: { flex: 1, padding: 24, backgroundColor: colors.bg, gap: 12 },
  brand: { fontSize: 36, fontWeight: '800', color: colors.cream, marginTop: 24 },
  lede: { color: colors.muted, fontSize: 15 },
  muted: { color: colors.muted, fontSize: 13 },
  user: { color: colors.gold, fontSize: 18, fontWeight: '600', marginTop: 16 },
  primary: {
    backgroundColor: colors.mint,
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryText: { color: '#042016', fontWeight: '700', fontSize: 16 },
  secondary: {
    borderWidth: 1,
    borderColor: 'rgba(243,235,224,0.2)',
    padding: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  secondaryText: { color: colors.cream, fontWeight: '600' },
});
