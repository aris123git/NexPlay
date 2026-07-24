import { prisma } from '../db.js';
import { creditCoins } from '../wallet/service.js';
import { notify } from '../notifications/service.js';

export async function requireStaff(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.role !== 'admin' && user.role !== 'moderator') {
    throw new Error('FORBIDDEN');
  }
  return user;
}

export async function requireAdmin(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.role !== 'admin') throw new Error('FORBIDDEN');
  return user;
}

async function audit(
  actorId: string,
  action: string,
  targetType?: string,
  targetId?: string,
  meta: Record<string, unknown> = {},
) {
  await prisma.adminAuditLog.create({
    data: {
      actorId,
      action,
      targetType,
      targetId,
      metaJson: JSON.stringify(meta),
    },
  });
}

export async function listUsers(take = 50, q?: string) {
  return prisma.user.findMany({
    where: q
      ? {
          OR: [
            { email: { contains: q } },
            { profile: { username: { contains: q } } },
          ],
        }
      : undefined,
    take,
    orderBy: { createdAt: 'desc' },
    include: { profile: true, wallet: true },
  });
}

export async function banUser(
  actorId: string,
  targetId: string,
  reason: string,
) {
  await requireModeratorOrAdmin(actorId);
  const user = await prisma.user.update({
    where: { id: targetId },
    data: {
      status: 'banned',
      bannedAt: new Date(),
      banReason: reason.slice(0, 300),
    },
  });
  await audit(actorId, 'user.ban', 'user', targetId, { reason });
  return user;
}

export async function unbanUser(actorId: string, targetId: string) {
  await requireModeratorOrAdmin(actorId);
  const user = await prisma.user.update({
    where: { id: targetId },
    data: { status: 'active', bannedAt: null, banReason: null },
  });
  await audit(actorId, 'user.unban', 'user', targetId);
  return user;
}

async function requireModeratorOrAdmin(userId: string) {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (u.role !== 'admin' && u.role !== 'moderator') throw new Error('FORBIDDEN');
  return u;
}

export async function setRole(actorId: string, targetId: string, role: string) {
  await requireAdmin(actorId);
  if (!['player', 'moderator', 'admin'].includes(role)) throw new Error('BAD_ROLE');
  const user = await prisma.user.update({
    where: { id: targetId },
    data: { role },
  });
  await audit(actorId, 'user.set_role', 'user', targetId, { role });
  return user;
}

export async function grantCoins(
  actorId: string,
  targetId: string,
  amount: number,
  reason: string,
) {
  await requireAdmin(actorId);
  const wallet = await creditCoins(targetId, amount, 'admin', { reason, actorId });
  await notify({
    userId: targetId,
    type: 'system',
    title: 'Récompense admin',
    body: `${amount >= 0 ? '+' : ''}${amount} NexCoins — ${reason}`,
    data: { amount },
  });
  await audit(actorId, 'wallet.grant', 'user', targetId, { amount, reason });
  return wallet;
}

export async function createSeason(
  actorId: string,
  input: {
    code: string;
    name: string;
    startsAt: string;
    endsAt: string;
    activate?: boolean;
  },
) {
  await requireAdmin(actorId);
  if (input.activate) {
    await prisma.season.updateMany({
      where: { status: 'active' },
      data: { status: 'completed' },
    });
  }
  const season = await prisma.season.create({
    data: {
      code: input.code,
      name: input.name,
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
      status: input.activate ? 'active' : 'upcoming',
    },
  });
  await audit(actorId, 'season.create', 'season', season.id, input);
  return season;
}

export async function listOpenReports() {
  const chat = await prisma.chatReport.findMany({
    where: { status: 'open' },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      message: true,
      reporter: { include: { profile: true } },
    },
  });
  const cheat = await prisma.cheatReport.findMany({
    where: { status: 'open' },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { reporter: { include: { profile: true } } },
  });
  return { chat, cheat };
}

export async function resolveCheatReport(
  actorId: string,
  reportId: string,
  status: 'actioned' | 'dismissed',
) {
  await requireModeratorOrAdmin(actorId);
  const row = await prisma.cheatReport.update({
    where: { id: reportId },
    data: { status },
  });
  await audit(actorId, 'cheat.resolve', 'cheat_report', reportId, { status });
  return row;
}

export async function globalStats() {
  const [users, matches, tournaments, clans, replays, openChatReports] =
    await Promise.all([
      prisma.user.count(),
      prisma.match.count({ where: { status: 'finished' } }),
      prisma.tournament.count(),
      prisma.clan.count(),
      prisma.matchReplay.count(),
      prisma.chatReport.count({ where: { status: 'open' } }),
    ]);
  return { users, matches, tournaments, clans, replays, openChatReports };
}

export async function listAudit(take = 40) {
  return prisma.adminAuditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take,
    include: { actor: { include: { profile: true } } },
  });
}
