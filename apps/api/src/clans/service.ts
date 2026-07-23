import { prisma } from '../db.js';
import { notify } from '../notifications/service.js';

export async function createClan(input: {
  name: string;
  tag: string;
  ownerId: string;
  countryCode?: string;
  description?: string;
  logoUrl?: string;
}) {
  const existingMembership = await prisma.clanMember.findUnique({
    where: { userId: input.ownerId },
  });
  if (existingMembership) throw new Error('ALREADY_IN_CLAN');

  const tag = input.tag.toUpperCase().slice(0, 6);
  const clan = await prisma.clan.create({
    data: {
      name: input.name,
      tag,
      ownerId: input.ownerId,
      countryCode: (input.countryCode ?? 'BF').toUpperCase(),
      description: input.description,
      logoUrl: input.logoUrl,
      members: {
        create: { userId: input.ownerId, role: 'owner' },
      },
    },
    include: { members: { include: { user: { include: { profile: true } } } } },
  });

  await notify({
    userId: input.ownerId,
    type: 'clan',
    title: 'Clan créé',
    body: `${clan.name} [${clan.tag}] est prêt`,
    data: { clanId: clan.id },
  });

  const badge = await prisma.badge.findUnique({ where: { code: 'clan_founder' } });
  if (badge) {
    await prisma.playerBadge.upsert({
      where: { userId_badgeId: { userId: input.ownerId, badgeId: badge.id } },
      create: { userId: input.ownerId, badgeId: badge.id },
      update: {},
    });
  }

  return clan;
}

export async function joinClan(clanId: string, userId: string) {
  const membership = await prisma.clanMember.findUnique({ where: { userId } });
  if (membership) throw new Error('ALREADY_IN_CLAN');

  const clan = await prisma.clan.findUniqueOrThrow({
    where: { id: clanId },
    include: { members: true },
  });
  if (clan.members.length >= clan.maxMembers) throw new Error('CLAN_FULL');

  await prisma.clanMember.create({
    data: { clanId, userId, role: 'member' },
  });

  await notify({
    userId: clan.ownerId,
    type: 'clan',
    title: 'Nouveau membre',
    body: `Un joueur a rejoint ${clan.name}`,
    data: { clanId, userId },
  });

  return getClan(clanId);
}

export async function leaveClan(userId: string) {
  const membership = await prisma.clanMember.findUnique({ where: { userId } });
  if (!membership) throw new Error('NOT_IN_CLAN');
  if (membership.role === 'owner') throw new Error('OWNER_CANNOT_LEAVE');
  await prisma.clanMember.delete({ where: { id: membership.id } });
  return { ok: true };
}

export async function addClanScore(userId: string, points: number) {
  const membership = await prisma.clanMember.findUnique({ where: { userId } });
  if (!membership || points <= 0) return null;
  return prisma.clan.update({
    where: { id: membership.clanId },
    data: { score: { increment: points }, rating: { increment: Math.min(points, 5) } },
  });
}

export async function getClan(id: string) {
  return prisma.clan.findUniqueOrThrow({
    where: { id },
    include: {
      members: {
        include: { user: { include: { profile: true } } },
        orderBy: { joinedAt: 'asc' },
      },
      owner: { include: { profile: true } },
    },
  });
}

export async function listClans(take = 40) {
  const clans = await prisma.clan.findMany({
    orderBy: { score: 'desc' },
    take,
    include: { _count: { select: { members: true } } },
  });
  return clans.map((c, i) => ({
    rank: i + 1,
    id: c.id,
    name: c.name,
    tag: c.tag,
    countryCode: c.countryCode,
    score: c.score,
    rating: c.rating,
    logoUrl: c.logoUrl,
    members: c._count.members,
    maxMembers: c.maxMembers,
  }));
}

export async function getUserClan(userId: string) {
  const m = await prisma.clanMember.findUnique({
    where: { userId },
    include: { clan: { include: { _count: { select: { members: true } } } } },
  });
  return m;
}
