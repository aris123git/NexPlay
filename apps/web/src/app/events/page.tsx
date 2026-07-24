'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/i18n/provider';

type Challenge = {
  id: string;
  kind: string;
  titleKey: string;
  descriptionKey?: string | null;
  goal: { type: string; target: number; gameId?: string };
  reward: { nexCoins?: number };
  progress: number;
  completedAt: string | null;
  claimedAt: string | null;
  endsAt?: string | null;
};

export default function EventsPage() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const { t } = useI18n();
  const [list, setList] = useState<Challenge[]>([]);
  const [msg, setMsg] = useState('');

  async function load() {
    if (!session) return;
    const d = await api<{ challenges: Challenge[] }>('/api/events/challenges', {
      token: session.accessToken,
    });
    setList(d.challenges);
  }

  useEffect(() => {
    if (!loading && !session) router.replace('/auth');
  }, [loading, session, router]);

  useEffect(() => {
    void load();
  }, [session]);

  if (!session) {
    return (
      <Shell>
        <p className="muted">…</p>
      </Shell>
    );
  }

  async function claim(id: string) {
    if (!session) return;
    try {
      const r = await api<{ coins: number }>(`/api/events/challenges/${id}/claim`, {
        method: 'POST',
        token: session.accessToken,
        body: '{}',
      });
      setMsg(`+${r.coins} NexCoins`);
      await load();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  return (
    <Shell>
      <h1 className="hero-title" style={{ fontSize: '1.8rem' }}>
        {t('events.title')}
      </h1>
      <p className="lede">{t('events.lede')}</p>
      {msg ? <p className="muted">{msg}</p> : null}

      {list.map((c) => {
        const pct = Math.min(100, Math.round((c.progress / c.goal.target) * 100));
        return (
          <div key={c.id} style={{ marginBottom: '1rem' }}>
            <div className="game-row">
              <div className="game-icon">{c.kind.slice(0, 2).toUpperCase()}</div>
              <div className="game-meta">
                <strong>{t(c.titleKey)}</strong>
                <span>
                  {c.descriptionKey ? t(c.descriptionKey) : ''} · +{c.reward.nexCoins ?? 0} coins
                </span>
              </div>
              {c.completedAt && !c.claimedAt ? (
                <button
                  className="btn btn-primary"
                  style={{ width: 'auto' }}
                  onClick={() => claim(c.id)}
                >
                  {t('events.claim')}
                </button>
              ) : c.claimedAt ? (
                <span className="pill">✓</span>
              ) : null}
            </div>
            <div className="xp-bar" style={{ width: '100%', marginTop: 4 }}>
              <div style={{ width: `${pct}%` }} />
            </div>
            <p className="muted" style={{ fontSize: '0.75rem', margin: '0.25rem 0 0' }}>
              {t('events.progress')}: {c.progress}/{c.goal.target}
            </p>
          </div>
        );
      })}
    </Shell>
  );
}
