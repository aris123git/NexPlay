'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Shell } from '@/components/Shell';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { flag, avatarGlyph } from '@/lib/display';

type Friend = {
  userId: string;
  username?: string;
  displayName?: string;
  countryCode?: string;
  avatarUrl?: string | null;
  favorite: boolean;
  presence?: { status: string; matchId?: string; online: boolean; lastSeenAt?: string | null };
};

export default function SocialPage() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pending, setPending] = useState<
    { friendshipId: string; from: { username?: string; displayName?: string; countryCode?: string } }[]
  >([]);
  const [msg, setMsg] = useState('');
  const [chatUserId, setChatUserId] = useState<string | null>(null);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [channelKey, setChannelKey] = useState<string | null>(null);
  const [messages, setMessages] = useState<
    { id: string; username?: string; body: string; createdAt: string }[]
  >([]);
  const [emojis, setEmojis] = useState<{ code: string; emoji: string }[]>([]);

  async function load() {
    if (!session) return;
    const data = await api<{ friends: Friend[]; pending: typeof pending }>('/api/friends', {
      token: session.accessToken,
    });
    setFriends(data.friends);
    setPending(data.pending);
  }

  useEffect(() => {
    if (!loading && !session) router.replace('/auth');
  }, [loading, session, router]);

  useEffect(() => {
    void load();
    api<{ emojis: { code: string; emoji: string }[] }>('/api/chat/emojis').then((d) =>
      setEmojis(d.emojis),
    );
  }, [session]);

  if (!session) return <Shell><p className="muted">…</p></Shell>;

  async function addFriend(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await api('/api/friends/request', {
        method: 'POST',
        token: session!.accessToken,
        body: JSON.stringify({ username: String(fd.get('username')) }),
      });
      setMsg('Demande envoyée');
      (e.target as HTMLFormElement).reset();
      await load();
    } catch (err) {
      setMsg((err as Error).message);
    }
  }

  async function respond(id: string, accept: boolean) {
    await api(`/api/friends/${id}/respond`, {
      method: 'POST',
      token: session!.accessToken,
      body: JSON.stringify({ accept }),
    });
    await load();
  }

  async function openDm(userId: string) {
    const data = await api<{
      channel: { id: string; key: string };
      messages: typeof messages;
    }>('/api/chat/dm', {
      method: 'POST',
      token: session!.accessToken,
      body: JSON.stringify({ userId }),
    });
    setChatUserId(userId);
    setChannelId(data.channel.id);
    setChannelKey(data.channel.key);
    setMessages(data.messages);
  }

  async function openClanChat() {
    try {
      const data = await api<{
        channel: { id: string; key: string };
        messages: typeof messages;
      }>('/api/chat/clan', {
        method: 'POST',
        token: session!.accessToken,
        body: '{}',
      });
      setChatUserId(null);
      setChannelId(data.channel.id);
      setChannelKey(data.channel.key);
      setMessages(data.messages);
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  async function sendChat(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!channelId) return;
    const fd = new FormData(e.currentTarget);
    const body = String(fd.get('body') || '');
    const res = await api<{ message: (typeof messages)[0] }>('/api/chat/messages', {
      method: 'POST',
      token: session!.accessToken,
      body: JSON.stringify({ channelId, body }),
    });
    setMessages((m) => [...m, res.message]);
    (e.target as HTMLFormElement).reset();
  }

  async function joinFriend(friendId: string) {
    const res = await api<{ matchId: string }>('/api/friends/join', {
      method: 'POST',
      token: session!.accessToken,
      body: JSON.stringify({ friendId, gameId: 'ludo' }),
    });
    router.push(`/match/${res.matchId}`);
  }

  function statusLabel(f: Friend) {
    const s = f.presence?.status ?? 'offline';
    if (s === 'in_match') return 'En partie';
    if (s === 'in_queue') return 'En recherche';
    if (s === 'online') return 'En ligne';
    return 'Hors ligne';
  }

  return (
    <Shell>
      <h1 className="hero-title" style={{ fontSize: '1.8rem' }}>
        Social
      </h1>
      <p className="lede">Amis, présence, chat privé & clan.</p>
      {msg ? <p className="muted">{msg}</p> : null}

      <div className="stack" style={{ marginBottom: '1rem' }}>
        <button className="btn btn-secondary" onClick={openClanChat}>
          Chat de clan
        </button>
        <Link href="/replays" className="btn btn-secondary">
          Mes replays
        </Link>
      </div>

      {pending.length > 0 ? (
        <>
          <p className="section-label">Demandes</p>
          {pending.map((p) => (
            <div className="game-row" key={p.friendshipId}>
              <div className="game-icon">{flag(p.from.countryCode)}</div>
              <div className="game-meta">
                <strong>{p.from.displayName}</strong>
                <span>@{p.from.username}</span>
              </div>
              <button className="btn btn-ghost" style={{ width: 'auto' }} onClick={() => respond(p.friendshipId, true)}>
                OK
              </button>
            </div>
          ))}
        </>
      ) : null}

      <p className="section-label">Amis</p>
      {friends.length === 0 ? (
        <p className="muted">Ajoute ton premier ami.</p>
      ) : (
        friends.map((f) => (
          <div className="game-row" key={f.userId}>
            <div className="game-icon">{avatarGlyph(f.avatarUrl, f.username)}</div>
            <div className="game-meta">
              <strong>
                {f.favorite ? '★ ' : ''}
                {flag(f.countryCode)} {f.displayName}
              </strong>
              <span>
                @{f.username} · {statusLabel(f)}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button className="btn btn-ghost" style={{ width: 'auto', padding: '0.3rem 0.5rem' }} onClick={() => openDm(f.userId)}>
                Chat
              </button>
              <button className="btn btn-ghost" style={{ width: 'auto', padding: '0.3rem 0.5rem' }} onClick={() => joinFriend(f.userId)}>
                Jouer
              </button>
            </div>
          </div>
        ))
      )}

      <form onSubmit={addFriend} className="stack" style={{ marginTop: '1rem' }}>
        <div className="field">
          <label htmlFor="username">Ajouter un ami</label>
          <input id="username" name="username" placeholder="pseudo" required />
        </div>
        <button className="btn btn-primary" type="submit">
          Envoyer la demande
        </button>
      </form>

      {channelId ? (
        <>
          <p className="section-label">
            Chat {channelKey?.startsWith('clan:') ? 'clan' : chatUserId ? 'privé' : ''}
          </p>
          <div style={{ maxHeight: 200, overflow: 'auto', marginBottom: 8 }}>
            {messages.map((m) => (
              <p className="chat-line" key={m.id}>
                <b>{m.username}</b> {m.body}
              </p>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {emojis.map((e) => (
              <button
                key={e.code}
                type="button"
                className="btn btn-ghost"
                style={{ width: 'auto', padding: '0.2rem 0.4rem' }}
                onClick={() => {
                  const input = document.getElementById('chatBody') as HTMLInputElement | null;
                  if (input) input.value = `${input.value} ${e.code}`.trim();
                }}
              >
                {e.emoji}
              </button>
            ))}
          </div>
          <form onSubmit={sendChat} style={{ display: 'flex', gap: 8 }}>
            <input
              id="chatBody"
              name="body"
              placeholder="Message… :gg: :fire:"
              style={{
                flex: 1,
                background: 'rgba(0,0,0,.28)',
                border: '1px solid rgba(243,235,224,.12)',
                borderRadius: 12,
                padding: '0.75rem',
                color: 'var(--cream)',
              }}
            />
            <button className="btn btn-secondary" style={{ width: 'auto' }} type="submit">
              OK
            </button>
          </form>
        </>
      ) : null}
    </Shell>
  );
}
