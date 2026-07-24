'use client';

import Link from 'next/link';
import { Shell } from '@/components/Shell';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/i18n/provider';

export default function HomePage() {
  const { session } = useAuth();
  const { t } = useI18n();

  return (
    <Shell>
      <p className="section-label" style={{ marginTop: 0 }}>
        {t('home.tagline')}
      </p>
      <h1 className="hero-title">NexPlay</h1>
      <p className="lede">{t('home.lede')}</p>

      <div className="stack">
        {session ? (
          <Link href="/play" className="btn btn-primary">
            {t('home.cta.play')}
          </Link>
        ) : (
          <Link href="/auth" className="btn btn-primary">
            {t('home.cta.auth')}
          </Link>
        )}
        <Link href="/leaderboard" className="btn btn-secondary">
          {t('home.cta.rank')}
        </Link>
        <Link href="/shop" className="btn btn-secondary">
          {t('nav.shop')}
        </Link>
      </div>

      <p className="section-label">Jeux</p>
      <div>
        {[
          { id: 'LU', name: 'Ludo', status: 'Live', ok: true },
          { id: 'DA', name: 'Dames', status: 'Live', ok: true },
          { id: 'ÉC', name: 'Échecs', status: 'Roadmap', ok: false },
          { id: 'DO', name: 'Dominos', status: 'Roadmap', ok: false },
          { id: 'AW', name: 'Awalé', status: 'Roadmap', ok: false },
        ].map((g) => (
          <div className="game-row" key={g.name}>
            <div className={`game-icon ${g.ok ? '' : 'disabled'}`}>{g.id}</div>
            <div className="game-meta">
              <strong>{g.name}</strong>
              <span>{g.status}</span>
            </div>
            {g.ok ? <span className="pill">Live</span> : null}
          </div>
        ))}
      </div>
    </Shell>
  );
}
