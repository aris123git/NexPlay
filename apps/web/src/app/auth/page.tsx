'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { useAuth } from '@/lib/auth';

export default function AuthPage() {
  const { login, register, session } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (session) {
    router.replace('/play');
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    try {
      if (mode === 'login') {
        await login(String(fd.get('email')), String(fd.get('password')));
      } else {
        await register({
          email: String(fd.get('email')),
          password: String(fd.get('password')),
          username: String(fd.get('username')),
          countryCode: String(fd.get('countryCode') || 'BF'),
        });
      }
      router.push('/play');
    } catch (err) {
      setError((err as Error).message || 'Erreur');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <h1 className="hero-title" style={{ fontSize: '2rem' }}>
        {mode === 'login' ? 'Connexion' : 'Rejoindre NexPlay'}
      </h1>
      <p className="lede">
        Pseudo, pays, niveau — votre profil compétitif commence ici.
      </p>

      <form onSubmit={onSubmit} className="stack">
        {mode === 'register' && (
          <>
            <div className="field">
              <label htmlFor="username">Pseudo</label>
              <input id="username" name="username" required minLength={3} maxLength={20} />
            </div>
            <div className="field">
              <label htmlFor="countryCode">Pays</label>
              <select id="countryCode" name="countryCode" defaultValue="BF">
                <option value="BF">Burkina Faso</option>
                <option value="CI">Côte d’Ivoire</option>
                <option value="SN">Sénégal</option>
                <option value="ML">Mali</option>
                <option value="FR">France</option>
                <option value="US">États-Unis</option>
              </select>
            </div>
          </>
        )}
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required />
        </div>
        <div className="field">
          <label htmlFor="password">Mot de passe</label>
          <input id="password" name="password" type="password" required minLength={8} />
        </div>
        {error ? <p className="error">{error}</p> : null}
        <button className="btn btn-primary" disabled={busy} type="submit">
          {busy ? '…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
        </button>
      </form>

      <button
        type="button"
        className="btn btn-ghost"
        style={{ marginTop: '1rem' }}
        onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
      >
        {mode === 'login' ? 'Pas de compte ? Inscription' : 'Déjà inscrit ? Connexion'}
      </button>
    </Shell>
  );
}
