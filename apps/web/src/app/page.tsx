'use client';

import Link from 'next/link';
import { Shell } from '@/components/Shell';
import { useAuth } from '@/lib/auth';

export default function HomePage() {
  const { session } = useAuth();

  return (
    <Shell>
      <p className="section-label" style={{ marginTop: 0 }}>
        Burkina Faso → Monde
      </p>
      <h1 className="hero-title">NexPlay</h1>
      <p className="lede">
        Affrontez des joueurs du monde entier sur des jeux de société compétitifs.
        Ludo disponible maintenant — dames, échecs, awalé et dominos suivent.
      </p>

      <div className="stack">
        {session ? (
          <Link href="/play" className="btn btn-primary">
            Jouer au Ludo
          </Link>
        ) : (
          <Link href="/auth" className="btn btn-primary">
            Créer un compte
          </Link>
        )}
        <Link href="/leaderboard" className="btn btn-secondary">
          Voir le classement
        </Link>
      </div>

      <p className="section-label">Jeux</p>
      <div>
        {[
          { id: 'LU', name: 'Ludo', status: 'Disponible', ok: true },
          { id: 'DA', name: 'Dames', status: 'Bientôt', ok: false },
          { id: 'ÉC', name: 'Échecs', status: 'Bientôt', ok: false },
          { id: 'AW', name: 'Awalé', status: 'Bientôt', ok: false },
          { id: 'DO', name: 'Dominos', status: 'Bientôt', ok: false },
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
