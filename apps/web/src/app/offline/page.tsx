'use client';

import Link from 'next/link';
import { Shell } from '@/components/Shell';

export default function OfflinePage() {
  return (
    <Shell>
      <h1 className="hero-title" style={{ fontSize: '1.8rem' }}>
        Hors ligne
      </h1>
      <p className="lede">
        Connexion indisponible. Vous pouvez rouvrir les pages déjà visitées, ou réessayer quand le
        réseau revient.
      </p>
      <div className="stack">
        <button className="btn btn-primary" type="button" onClick={() => location.reload()}>
          Réessayer
        </button>
        <Link href="/" className="btn btn-secondary">
          Accueil (cache)
        </Link>
      </div>
    </Shell>
  );
}
