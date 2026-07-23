'use client';

import { useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { api } from '@/lib/api';

type Entry = {
  rank: number;
  elo: number;
  wins: number;
  played: number;
  username?: string;
  displayName?: string;
  countryCode?: string;
  level?: number;
};

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    api<{ entries: Entry[] }>('/api/leaderboard/ludo')
      .then((d) => setEntries(d.entries))
      .catch(() => setEntries([]));
  }, []);

  return (
    <Shell>
      <h1 className="hero-title" style={{ fontSize: '2rem' }}>
        Classement Ludo
      </h1>
      <p className="lede">ELO mondial — le Burkina ouvre la voie.</p>

      {entries.length === 0 ? (
        <p className="muted">Pas encore de classés. Jouez une partie pour apparaître ici.</p>
      ) : (
        entries.map((e) => (
          <div className="game-row" key={e.rank}>
            <div className="game-icon">#{e.rank}</div>
            <div className="game-meta">
              <strong>{e.displayName ?? e.username}</strong>
              <span>
                @{e.username} · {e.countryCode} · {e.wins}V / {e.played}P
              </span>
            </div>
            <span className="pill">{e.elo}</span>
          </div>
        ))
      )}
    </Shell>
  );
}
