'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getSocket } from '@/lib/socket';

type Notif = {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  readAt?: string | null;
  createdAt: string;
};

export function useNotifications() {
  const { session } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!session) return;
    let alive = true;
    api<{ items: Notif[]; unread: number }>('/api/notifications', {
      token: session.accessToken,
    }).then((d) => {
      if (!alive) return;
      setItems(d.items);
      setUnread(d.unread);
    });

    const socket = getSocket(session.accessToken);
    const onNotify = (n: Notif) => {
      setItems((prev) => [n, ...prev].slice(0, 40));
      setUnread((u) => u + 1);
    };
    socket.on('notify', onNotify);
    return () => {
      alive = false;
      socket.off('notify', onNotify);
    };
  }, [session]);

  async function markAllRead() {
    if (!session) return;
    await api('/api/notifications/read', {
      method: 'POST',
      token: session.accessToken,
      body: '{}',
    });
    setUnread(0);
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
  }

  return { items, unread, markAllRead, setItems };
}
