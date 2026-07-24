import type { Server } from 'socket.io';
import { prisma } from '../db.js';
import { areFriends, isBlocked } from '../friends/service.js';
import { getUserClan } from '../clans/service.js';

let ioRef: Server | null = null;

export function bindChatIo(io: Server) {
  ioRef = io;
}

const EMOJI_SHORTCODES: Record<string, string> = {
  ':fire:': '🔥',
  ':gg:': '👏',
  ':bf:': '🇧🇫',
  ':trophy:': '🏆',
  ':heart:': '❤️',
  ':laugh:': '😂',
  ':wave:': '👋',
  ':strong:': '💪',
};

export function expandEmojis(text: string): string {
  return text.replace(/:[a-z0-9_]+:/gi, (m) => EMOJI_SHORTCODES[m.toLowerCase()] ?? m);
}

async function ensureChannel(input: {
  type: string;
  key: string;
  title?: string;
  clanId?: string;
  tournamentId?: string;
  matchId?: string;
}) {
  return prisma.chatChannel.upsert({
    where: { key: input.key },
    create: input,
    update: { title: input.title },
  });
}

export async function getOrCreateDm(userA: string, userB: string) {
  if (await isBlocked(userA, userB)) throw new Error('BLOCKED');
  if (!(await areFriends(userA, userB))) throw new Error('NOT_FRIENDS');
  const [a, b] = [userA, userB].sort();
  return ensureChannel({
    type: 'dm',
    key: `dm:${a}:${b}`,
    title: 'Message privé',
  });
}

export async function getOrCreateClanChannel(userId: string) {
  const membership = await getUserClan(userId);
  if (!membership) throw new Error('NOT_IN_CLAN');
  return ensureChannel({
    type: 'clan',
    key: `clan:${membership.clanId}`,
    title: membership.clan.name,
    clanId: membership.clanId,
  });
}

export async function getOrCreateTournamentChannel(tournamentId: string) {
  const t = await prisma.tournament.findUniqueOrThrow({ where: { id: tournamentId } });
  return ensureChannel({
    type: 'tournament',
    key: `tournament:${tournamentId}`,
    title: t.name,
    tournamentId,
  });
}

export async function getOrCreateMatchChannel(matchId: string) {
  return ensureChannel({
    type: 'match',
    key: `match:${matchId}`,
    title: 'Chat de partie',
    matchId,
  });
}

export async function postMessage(input: {
  channelId: string;
  senderId: string;
  body: string;
}) {
  const raw = input.body.trim().slice(0, 500);
  if (!raw) throw new Error('EMPTY');
  const body = expandEmojis(raw);
  const kind = /[\u{1F300}-\u{1FAFF}]/u.test(body) && body.replace(/\s/g, '').length <= 8
    ? 'emoji'
    : 'plain';

  const channel = await prisma.chatChannel.findUniqueOrThrow({
    where: { id: input.channelId },
  });

  // Authz légère
  if (channel.type === 'dm') {
    const [, a, b] = channel.key.split(':');
    if (input.senderId !== a && input.senderId !== b) throw new Error('FORBIDDEN');
  }
  if (channel.type === 'clan' && channel.clanId) {
    const m = await prisma.clanMember.findUnique({ where: { userId: input.senderId } });
    if (!m || m.clanId !== channel.clanId) throw new Error('FORBIDDEN');
  }

  const sender = await prisma.playerProfile.findUniqueOrThrow({
    where: { userId: input.senderId },
  });

  const msg = await prisma.chatMessage.create({
    data: {
      channelId: input.channelId,
      senderId: input.senderId,
      body,
      kind,
    },
  });

  const payload = {
    id: msg.id,
    channelId: msg.channelId,
    channelKey: channel.key,
    senderId: input.senderId,
    username: sender.username,
    body: msg.body,
    kind: msg.kind,
    createdAt: msg.createdAt,
  };

  ioRef?.to(`chat:${channel.key}`).emit('chat:message', payload);
  return payload;
}

export async function listMessages(channelId: string, take = 50) {
  const rows = await prisma.chatMessage.findMany({
    where: { channelId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take,
    include: { sender: { include: { profile: true } } },
  });
  return rows.reverse().map((m) => ({
    id: m.id,
    senderId: m.senderId,
    username: m.sender.profile?.username,
    body: m.body,
    kind: m.kind,
    createdAt: m.createdAt,
  }));
}

export async function reportMessage(
  reporterId: string,
  messageId: string,
  reason: string,
) {
  const report = await prisma.chatReport.create({
    data: {
      messageId,
      reporterId,
      reason: reason.slice(0, 300),
    },
  });
  return report;
}

export async function moderateMessage(
  actorId: string,
  messageId: string,
  action: 'delete' | 'dismiss_reports',
) {
  if (action === 'delete') {
    await prisma.chatMessage.update({
      where: { id: messageId },
      data: { deletedAt: new Date(), deletedBy: actorId },
    });
    await prisma.chatReport.updateMany({
      where: { messageId, status: 'open' },
      data: { status: 'actioned' },
    });
  } else {
    await prisma.chatReport.updateMany({
      where: { messageId, status: 'open' },
      data: { status: 'dismissed' },
    });
  }
  return { ok: true };
}

export const emojiCatalog = Object.entries(EMOJI_SHORTCODES).map(([code, emoji]) => ({
  code,
  emoji,
}));
