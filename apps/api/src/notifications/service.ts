import type { Server } from 'socket.io';
import { prisma } from '../db.js';

let ioRef: Server | null = null;

export function bindNotificationIo(io: Server) {
  ioRef = io;
}

export type NotifyInput = {
  userId: string;
  type: 'match_invite' | 'match_result' | 'tournament' | 'season' | 'clan' | 'system';
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

export async function notify(input: NotifyInput) {
  const row = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      dataJson: JSON.stringify(input.data ?? {}),
    },
  });

  ioRef?.to(`user:${input.userId}`).emit('notify', {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    data: input.data ?? {},
    createdAt: row.createdAt,
  });

  return row;
}

export async function notifyMany(
  userIds: string[],
  payload: Omit<NotifyInput, 'userId'>,
) {
  await Promise.all(userIds.map((userId) => notify({ ...payload, userId })));
}

export async function listNotifications(userId: string, limit = 40) {
  const rows = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    body: r.body,
    data: JSON.parse(r.dataJson),
    readAt: r.readAt,
    createdAt: r.createdAt,
  }));
}

export async function markRead(userId: string, ids?: string[]) {
  await prisma.notification.updateMany({
    where: {
      userId,
      readAt: null,
      ...(ids?.length ? { id: { in: ids } } : {}),
    },
    data: { readAt: new Date() },
  });
}

export async function unreadCount(userId: string) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}
