'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { flag } from '@/lib/display';

type Tournament = {
  id: string;
  name: string;
  gameId: string;
  gameKind: string;
  status: string;
  maxEntries: number;
  entries: {
    id: string;
    seed: number | null;
    status: string;
    user?: { profile?: { username: string; displayName: string; countryCode: string } | null } | null;
    clan?: { name: string; tag: string } | null;
  }[];
  rounds: {
    id: string;
    round: number;
    position: number;
    entryAId: string | null;
    entryBId: string | null;
    winnerEntryId: string | null;
    status: string;
  }[];
};

export default function TournamentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { session, loading } = useAuth();
  const router = useRouter();
  const [t, setT] = useState<Tournament | null>(null);
  const [msg, setMsg] = useState('');

  async function load() {
    const data = await api<{ tournament: Tournament }>(`/api/tournaments/${id}`);
    setT(data.tournament);
  }

  useEffect(() => {
    if (!loading && !session) router.replace('/auth');
  }, [loading, session, router]);

  useEffect(() => {
    if (session && id) void load();
  }, [session, id]);

  if (!session || !t) {
    return (
      <Shell>
        <p className="muted">Chargement…</p>
      </Shell>
    );
  }

  async function register() {
    try {
      await api(`/api/tournaments/${id}/register`, {
        method: 'POST',
        token: session!.accessToken,
        body: '{}',
      });
      setMsg('Inscrit !');
      await load();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  async function start() {
    try {
      await api(`/api/tournaments/${id}/start`, {
        method: 'POST',
        token: session!.accessToken,
        body: '{}',
      });
      setMsg('Bracket généré');
      await load();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  async function advance(matchId: string, winnerEntryId: string) {
    await api(`/api/tournaments/matches/${matchId}/advance`, {
      method: 'POST',
      token: session!.accessToken,
      body: JSON.stringify({ winnerEntryId }),
    });
    await load();
  }

  const byId = Object.fromEntries(t.entries.map((e) => [e.id, e]));

  return (
    <Shell>
      <p className="section-label" style={{ marginTop: 0 }}>
        {t.gameKind} · {t.gameId}
      </p>
      <h1 className="hero-title" style={{ fontSize: '1.7rem' }}>
        {t.name}
      </h1>
      <p className="lede">
        Statut <strong>{t.status}</strong> · {t.entries.length}/{t.maxEntries} inscrits
      </p>
      {msg ? <p className="muted">{msg}</p> : null}

      <div className="stack">
        {t.status === 'open' ? (
          <button className="btn btn-primary" onClick={register}>
            S’inscrire
          </button>
        ) : null}
        {t.status === 'open' && t.entries.length >= 2 ? (
          <button className="btn btn-secondary" onClick={start}>
            Générer le tableau
          </button>
        ) : null}
      </div>

      <p className="section-label">Inscrits</p>
      {t.entries.map((e) => (
        <div className="game-row" key={e.id}>
          <div className="game-icon">#{e.seed ?? '—'}</div>
          <div className="game-meta">
            <strong>
              {e.user?.profile
                ? `${flag(e.user.profile.countryCode)} ${e.user.profile.displayName}`
                : e.clan
                  ? `[${e.clan.tag}] ${e.clan.name}`
                  : e.id.slice(0, 6)}
            </strong>
            <span>{e.status}</span>
          </div>
        </div>
      ))}

      <p className="section-label">Tableau</p>
      {t.rounds.length === 0 ? (
        <p className="muted">Pas encore de bracket.</p>
      ) : (
        t.rounds.map((m) => {
          const a = m.entryAId ? byId[m.entryAId] : null;
          const b = m.entryBId ? byId[m.entryBId] : null;
          const label = (e: typeof a) =>
            e?.user?.profile?.username ?? e?.clan?.tag ?? (e ? '…' : 'TBD');
          return (
            <div className="game-row" key={m.id} style={{ flexWrap: 'wrap' }}>
              <div className="game-meta" style={{ flex: '1 1 100%' }}>
                <strong>
                  R{m.round} · M{m.position + 1} · {m.status}
                </strong>
                <span>
                  {label(a)} vs {label(b)}
                  {m.winnerEntryId ? ` → ${label(byId[m.winnerEntryId])}` : ''}
                </span>
              </div>
              {m.status === 'ready' && m.entryAId && m.entryBId ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className="btn btn-ghost"
                    style={{ width: 'auto' }}
                    onClick={() => advance(m.id, m.entryAId!)}
                  >
                    {label(a)} gagne
                  </button>
                  <button
                    className="btn btn-ghost"
                    style={{ width: 'auto' }}
                    onClick={() => advance(m.id, m.entryBId!)}
                  >
                    {label(b)} gagne
                  </button>
                </div>
              ) : null}
              {t.gameKind === 'EXTERNAL' && m.status === 'ready' ? (
                <p className="muted" style={{ fontSize: '0.75rem', width: '100%' }}>
                  Externe : soumettre preuve via API `/external-result` puis valider.
                </p>
              ) : null}
            </div>
          );
        })
      )}
    </Shell>
  );
}
