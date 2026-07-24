'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/i18n/provider';

type Item = {
  id: string;
  sku: string;
  category: string;
  nameKey: string;
  descriptionKey: string | null;
  priceCoins: number;
  rarity: string;
};

export default function ShopPage() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const { t } = useI18n();
  const [items, setItems] = useState<Item[]>([]);
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [equipped, setEquipped] = useState<Record<string, string>>({});
  const [coins, setCoins] = useState(0);
  const [msg, setMsg] = useState('');
  const [filter, setFilter] = useState('all');

  async function load() {
    const shop = await api<{ items: Item[] }>(
      filter === 'all' ? '/api/shop' : `/api/shop?category=${filter}`,
    );
    setItems(shop.items);
    if (!session) return;
    const inv = await api<{
      items: { sku: string }[];
      equipped: Record<string, string>;
    }>('/api/shop/inventory', { token: session.accessToken });
    setOwned(new Set(inv.items.map((i) => i.sku)));
    setEquipped(inv.equipped);
    const w = await api<{ nexCoins: number }>('/api/wallet', {
      token: session.accessToken,
    });
    setCoins(w.nexCoins);
  }

  useEffect(() => {
    if (!loading && !session) router.replace('/auth');
  }, [loading, session, router]);

  useEffect(() => {
    if (session) void load();
  }, [session, filter]);

  if (!session) {
    return (
      <Shell>
        <p className="muted">…</p>
      </Shell>
    );
  }

  async function buy(sku: string) {
    if (!session) return;
    try {
      await api('/api/shop/purchase', {
        method: 'POST',
        token: session.accessToken,
        body: JSON.stringify({ sku }),
      });
      setMsg(`OK · ${sku}`);
      await load();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  async function equip(sku: string) {
    if (!session) return;
    await api('/api/shop/equip', {
      method: 'POST',
      token: session.accessToken,
      body: JSON.stringify({ sku }),
    });
    await load();
  }

  const cats = ['all', 'avatar', 'frame', 'emote', 'badge', 'dice_skin', 'board', 'sfx', 'anim'];

  return (
    <Shell>
      <h1 className="hero-title" style={{ fontSize: '1.8rem' }}>
        {t('shop.title')}
      </h1>
      <p className="lede">
        {t('shop.lede')} · {coins} NexCoins
      </p>
      {msg ? <p className="muted">{msg}</p> : null}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {cats.map((c) => (
          <button
            key={c}
            type="button"
            className={`btn ${filter === c ? 'btn-primary' : 'btn-ghost'}`}
            style={{ width: 'auto', padding: '0.4rem 0.7rem' }}
            onClick={() => setFilter(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {items.map((item) => {
        const has = owned.has(item.sku);
        const isEq = Object.values(equipped).includes(item.sku);
        return (
          <div className="game-row" key={item.sku}>
            <div className="game-icon">{item.category.slice(0, 2).toUpperCase()}</div>
            <div className="game-meta">
              <strong>{t(item.nameKey)}</strong>
              <span>
                {item.descriptionKey ? t(item.descriptionKey) : item.rarity} · {item.priceCoins} coins
              </span>
            </div>
            {has ? (
              <button
                className="btn btn-ghost"
                style={{ width: 'auto' }}
                onClick={() => equip(item.sku)}
              >
                {isEq ? '✓' : t('shop.equip')}
              </button>
            ) : (
              <button
                className="btn btn-secondary"
                style={{ width: 'auto' }}
                onClick={() => buy(item.sku)}
              >
                {t('shop.buy')}
              </button>
            )}
          </div>
        );
      })}
    </Shell>
  );
}
