'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/i18n/provider';
import type { LocaleCode } from '@/i18n/dictionaries';

export default function SettingsPage() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const { t, locale, setLocale } = useI18n();
  const [catalog, setCatalog] = useState<{
    locales: { code: string; name: string }[];
    currencies: { code: string; name: string }[];
    timezones: string[];
  } | null>(null);
  const [msg, setMsg] = useState('');
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    if (!loading && !session) router.replace('/auth');
  }, [loading, session, router]);

  useEffect(() => {
    api<typeof catalog extends infer T ? NonNullable<T> : never>('/api/i18n/catalog').then(
      setCatalog,
    );
  }, []);

  if (!session) {
    return (
      <Shell>
        <p className="muted">…</p>
      </Shell>
    );
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const loc = String(fd.get('locale')) as LocaleCode;
    await api('/api/i18n/preferences', {
      method: 'PATCH',
      token: session!.accessToken,
      body: JSON.stringify({
        locale: loc,
        currency: String(fd.get('currency')),
        timezone: String(fd.get('timezone')),
        countryCode: String(fd.get('countryCode')),
        regionName: String(fd.get('regionName') || '') || null,
        cityName: String(fd.get('cityName') || '') || null,
      }),
    });
    setLocale(loc);
    setMsg('OK');
  }

  async function createKey() {
    const res = await api<{ apiKey: string }>('/api/developer/keys', {
      method: 'POST',
      token: session!.accessToken,
      body: JSON.stringify({ name: 'Web console', scopes: ['read:public'] }),
    });
    setApiKey(res.apiKey);
  }

  return (
    <Shell>
      <h1 className="hero-title" style={{ fontSize: '1.7rem' }}>
        {t('settings.title')}
      </h1>
      {msg ? <p className="muted">{msg}</p> : null}

      <form onSubmit={save} className="stack">
        <div className="field">
          <label htmlFor="locale">Locale</label>
          <select id="locale" name="locale" defaultValue={locale}>
            {(catalog?.locales ?? []).map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="currency">Devise</label>
          <select id="currency" name="currency" defaultValue="XOF">
            {(catalog?.currencies ?? []).map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="timezone">Fuseau</label>
          <select id="timezone" name="timezone" defaultValue="Africa/Ouagadougou">
            {(catalog?.timezones ?? []).map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="countryCode">Pays</label>
          <select id="countryCode" name="countryCode" defaultValue="BF">
            {['BF', 'CI', 'SN', 'ML', 'FR', 'US', 'BR', 'MA'].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="regionName">Région</label>
          <input id="regionName" name="regionName" placeholder="Centre" />
        </div>
        <div className="field">
          <label htmlFor="cityName">Ville</label>
          <input id="cityName" name="cityName" placeholder="Ouagadougou" />
        </div>
        <button className="btn btn-primary" type="submit">
          {t('settings.save')}
        </button>
      </form>

      <p className="section-label">API publique</p>
      <p className="muted" style={{ fontSize: '0.85rem' }}>
        Crée une clé pour intégrer NexPlay (voir docs/PUBLIC_API.md).
      </p>
      <button className="btn btn-secondary" onClick={createKey}>
        Générer une clé API
      </button>
      {apiKey ? (
        <p className="lede" style={{ wordBreak: 'break-all' }}>
          {apiKey}
        </p>
      ) : null}
    </Shell>
  );
}
