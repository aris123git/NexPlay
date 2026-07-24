/**
 * Presence System — in-memory realtime + persist lastSeen / status.
 * Production: Redis SET + heartbeat TTL.
 */

import type { Server } from 'socket.io';
import { prisma } from '../db.js';

export type PresenceStatus = 'offline' | 'online' | 'in_match' | 'in_queue';

type LiveEntry = {
  userId: string;
  username: string;
  status: PresenceStatus;
  matchId?: string;
  sockets: Set<string>;
  updatedAt: number;
};

const live = new Map<string, LiveEntry>();
let ioRef: Server | null = null;

export function bindPresenceIo(io: Server) {
  ioRef = io;
}

export function onlineCount(): number {
  return [...live.values()].filter((e) => e.status !== 'offline').length;
}

export function getLiveSnapshot() {
  return [...live.values()]
    .filter((e) => e.status !== 'offline')
    .map((e) => ({
      userId: e.userId,
      username: e.username,
      status: e.status,
      matchId: e.matchId,
      updatedAt: e.updatedAt,
    }));
}

export function getPresence(userId: string) {
  const e = live.get(userId);
  if (e) {
    return {
      userId,
      status: e.status,
      matchId: e.matchId,
      online: e.status !== 'offline',
      lastSeenAt: new Date(e.updatedAt).toISOString(),
    };
  }
  return null;
}

async function persist(userId: string, status: PresenceStatus, matchId?: string | null) {
  await prisma.playerProfile.updateMany({
    where: { userId },
    data: {
      presenceStatus: status,
      lastSeenAt: new Date(),
      currentMatchId: matchId ?? null,
    },
  });
}

function emitPresence(userId: string) {
  const e = live.get(userId);
  if (!e || !ioRef) return;
  const payload = {
    userId: e.userId,
    username: e.username,
    status: e.status,
    matchId: e.matchId,
    onlineCount: onlineCount(),
  };
  ioRef.emit('presence:update', payload);
  ioRef.to(`user:${userId}`).emit('presence:self', payload);
}

export async function connectSocket(
  userId: string,
  username: string,
  socketId: string,
) {
  let e = live.get(userId);
  if (!e) {
    e = {
      userId,
      username,
      status: 'online',
      sockets: new Set(),
      updatedAt: Date.now(),
    };
    live.set(userId, e);
  }
  e.sockets.add(socketId);
  e.username = username;
  if (e.status === 'offline') e.status = 'online';
  e.updatedAt = Date.now();
  await persist(userId, e.status, e.matchId);
  emitPresence(userId);
  ioRef?.emit('presence:stats', { onlineCount: onlineCount() });
}

export async function disconnectSocket(userId: string, socketId: string) {
  const e = live.get(userId);
  if (!e) return;
  e.sockets.delete(socketId);
  if (e.sockets.size === 0) {
    e.status = 'offline';
    e.matchId = undefined;
    e.updatedAt = Date.now();
    await persist(userId, 'offline', null);
    emitPresence(userId);
    live.delete(userId);
  }
  ioRef?.emit('presence:stats', { onlineCount: onlineCount() });
}

export async function setStatus(
  userId: string,
  status: PresenceStatus,
  matchId?: string,
) {
  const e = live.get(userId);
  if (e) {
    e.status = status;
    e.matchId = matchId;
    e.updatedAt = Date.now();
  }
  await persist(userId, status, matchId ?? null);
  emitPresence(userId);
}

export async function getPresences(userIds: string[]) {
  const fromLive = userIds.map((id) => {
    const e = live.get(id);
    if (e) {
      return {
        userId: id,
        status: e.status,
        matchId: e.matchId,
        online: true,
        lastSeenAt: new Date(e.updatedAt).toISOString(),
      };
    }
    return null;
  });

  const missing = userIds.filter((_, i) => !fromLive[i]);
  if (missing.length === 0) return fromLive.filter(Boolean);

  const profiles = await prisma.playerProfile.findMany({
    where: { userId: { in: missing } },
    select: {
      userId: true,
      presenceStatus: true,
      lastSeenAt: true,
      currentMatchId: true,
    },
  });
  const map = new Map(profiles.map((p) => [p.userId, p]));

  return userIds.map((id) => {
    const liveHit = live.get(id);
    if (liveHit) {
      return {
        userId: id,
        status: liveHit.status,
        matchId: liveHit.matchId,
        online: liveHit.status !== 'offline',
        lastSeenAt: new Date(liveHit.updatedAt).toISOString(),
      };
    }
    const p = map.get(id);
    return {
      userId: id,
      status: (p?.presenceStatus as PresenceStatus) ?? 'offline',
      matchId: p?.currentMatchId ?? undefined,
      online: false,
      lastSeenAt: p?.lastSeenAt?.toISOString() ?? null,
    };
  });
}
