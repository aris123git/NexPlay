import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { api, type Session } from '../src/lib/api';
import { loadSession } from '../src/lib/session';
import { colors } from '../src/theme';

const GAMES = [
  { id: 'ludo', name: 'Ludo', mode: 'public-2', players: 2 },
  { id: 'dames', name: 'Dames', mode: 'public-2', players: 2 },
] as const;

export default function PlayScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [gameId, setGameId] = useState<(typeof GAMES)[number]['id']>('dames');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadSession().then((s) => {
      if (!s) router.replace('/auth');
      else setSession(s);
    });
  }, []);

  async function queue() {
    if (!session) return;
    setBusy(true);
    setStatus('Recherche…');
    try {
      const game = GAMES.find((g) => g.id === gameId)!;
      const res = await api<{ status: string; match?: { id: string } }>(
        '/api/matchmaking/queue',
        {
          method: 'POST',
          token: session.accessToken,
          body: JSON.stringify({
            gameId: game.id,
            mode: game.mode,
            playerCount: game.players,
            region: 'bf-ouaga',
          }),
        },
      );
      if (res.status === 'matched' && res.match) {
        setStatus(`Match trouvé : ${res.match.id}`);
        return;
      }
      setStatus('En file — relancez ou créez une partie privée sur le web.');
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function createPrivate() {
    if (!session) return;
    setBusy(true);
    try {
      const res = await api<{ matchId: string; inviteCode: string }>(
        '/api/matches/private',
        {
          method: 'POST',
          token: session.accessToken,
          body: JSON.stringify({
            gameId,
            mode: 'private-2',
            playerCount: 2,
          }),
        },
      );
      setStatus(`Privé ${res.inviteCode} · ${res.matchId}`);
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!session) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.mint} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choisir un jeu</Text>
      <View style={styles.row}>
        {GAMES.map((g) => (
          <Pressable
            key={g.id}
            style={[styles.chip, gameId === g.id && styles.chipOn]}
            onPress={() => setGameId(g.id)}
          >
            <Text style={[styles.chipText, gameId === g.id && styles.chipTextOn]}>{g.name}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable style={styles.primary} disabled={busy} onPress={queue}>
        <Text style={styles.primaryText}>Partie publique</Text>
      </Pressable>
      <Pressable style={styles.secondary} disabled={busy} onPress={createPrivate}>
        <Text style={styles.secondaryText}>Partie privée</Text>
      </Pressable>
      {status ? <Text style={styles.status}>{status}</Text> : null}
      <Text style={styles.hint}>
        Plateau temps réel : PWA web en V3.5 · board natif en itération suivante.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  container: { flex: 1, padding: 24, backgroundColor: colors.bg, gap: 14 },
  title: { fontSize: 24, fontWeight: '800', color: colors.cream },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(243,235,224,0.2)',
  },
  chipOn: { backgroundColor: colors.mint, borderColor: colors.mint },
  chipText: { color: colors.cream, fontWeight: '600' },
  chipTextOn: { color: '#042016' },
  primary: {
    backgroundColor: colors.mint,
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
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
  status: { color: colors.gold, marginTop: 8 },
  hint: { color: colors.muted, fontSize: 12, marginTop: 16 },
});
