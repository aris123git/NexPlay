'use client';

import { useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { api } from '@/lib/api';
import { useI18n } from '@/i18n/provider';
import { flag } from '@/lib/display';

type Entry = {
  rank: number;
  username?: string;
  displayName?: string;
  countryCode?: string;
  continentCode?: string;
  elo?: number;
  points?: number;
  score?: number;
  wins?: number;
  name?: string;
  tag?: string;
};

export default function LeaderboardPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<'game' | 'season' | 'clans'>('game');
  const [scope, setScope] = useState('world');
  const [continent, setContinent] = useState('AF');
  const [country, setCountry] = useState('BF');
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    void load();
  }, [tab, scope, continent, country]);

  async function load() {
    const q =
      scope === 'continent'
        ? `scope=${scope}&continent=${continent}`
        : scope === 'country'
          ? `scope=${scope}&country=${country}`
          : `scope=${scope}`;
    if (tab === 'game') {
      const d = await api<{ entries: Entry[] }>(`/api/rankings/game/ludo?${q}`);
      setEntries(d.entries);
    } else if (tab === 'season') {
      const d = await api<{ entries: Entry[] }>(`/api/rankings/season/active?${q}`);
      setEntries(d.entries);
    } else {
      const d = await api<{ entries: Entry[] }>(`/api/rankings/clans?${q}`);
      setEntries(d.entries);
    }
  }

  return (
    <Shell>
      <h1 className="hero-title" style={{ fontSize: '1.8rem' }}>
        {t('rankings.title')}
      </h1>
      <p className="lede">Monde · Continent · Pays · Saison · Clans</p>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {(
          [
            ['game', t('rankings.game')],
            ['season', t('rankings.season')],
            ['clans', t('rankings.clans')],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            className={`btn ${tab === k ? 'btn-primary' : 'btn-ghost'}`}
            style={{ width: 'auto', padding: '0.4rem 0.75rem' }}
            onClick={() => setTab(k)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="field">
        <label htmlFor="scope">Scope</label>
        <select id="scope" value={scope} onChange={(e) => setScope(e.target.value)}>
          <option value="world">{t('rankings.scope.world')}</option>
          <option value="continent">{t('rankings.scope.continent')}</option>
          <option value="country">{t('rankings.scope.country')}</option>
        </select>
      </div>
      {scope === 'continent' ? (
        <div className="field">
          <label htmlFor="cont">Continent</label>
          <select id="cont" value={continent} onChange={(e) => setContinent(e.target.value)}>
            {['AF', 'EU', 'AS', 'NA', 'SA', 'OC'].map((c) => (
              <option key={c} value={c}>
                {t(`continent.${c.toLowerCase()}`)}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {scope === 'country' ? (
        <div className="field">
          <label htmlFor="cty">Pays</label>
          <select id="cty" value={country} onChange={(e) => setCountry(e.target.value)}>
            {['BF', 'CI', 'SN', 'ML', 'FR', 'US'].map((c) => (
              <option key={c} value={c}>
                {flag(c)} {c}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {entries.length === 0 ? (
        <p className="muted">Aucune entrée pour ce filtre.</p>
      ) : (
        entries.map((e) => (
          <div className="game-row" key={`${e.rank}-${e.username ?? e.name}-${e.tag ?? ''}`}>
            <div className="game-icon">#{e.rank}</div>
            <div className="game-meta">
              <strong>
                {flag(e.countryCode)}{' '}
                {e.displayName ?? e.username ?? (e.tag ? `[${e.tag}] ${e.name}` : e.name)}
              </strong>
              <span>
                {e.continentCode ?? ''} · {e.wins ?? 0}V
              </span>
            </div>
            <span className="pill">{e.elo ?? e.points ?? e.score ?? 0}</span>
          </div>
        ))
      )}
    </Shell>
  );
}
