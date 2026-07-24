import { prisma } from '../db.js';
import { notify } from '../notifications/service.js';
import { getPresences } from '../presence/service.js';

function pairKey(a: string, b: string) {
  return [a, b].sort().join(':');
}

export async function sendFriendRequest(fromId: string, toUsername: string) {
  const target = await prisma.playerProfile.findUnique({ where: { username: toUsername } });
  if (!target) throw new Error('USER_NOT_FOUND');
  if (target.userId === fromId) throw new Error('CANNOT_FRIEND_SELF');

  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: fromId, addresseeId: target.userId },
        { requesterId: target.userId, addresseeId: fromId },
      ],
    },
  });
  if (existing) {
    if (existing.status === 'blocked') throw new Error('BLOCKED');
    if (existing.status === 'accepted') throw new Error('ALREADY_FRIENDS');
    return existing;
  }

  const row = await prisma.friendship.create({
    data: { requesterId: fromId, addresseeId: target.userId, status: 'pending' },
  });

  const from = await prisma.playerProfile.findUniqueOrThrow({ where: { userId: fromId } });
  await notify({
    userId: target.userId,
    type: 'system',
    title: 'Demande d’ami',
    body: `@${from.username} veut être ton ami`,
    data: { friendshipId: row.id, fromUsername: from.username },
  });
  return row;
}

export async function respondFriendRequest(
  userId: string,
  friendshipId: string,
  accept: boolean,
) {
  const row = await prisma.friendship.findUniqueOrThrow({ where: { id: friendshipId } });
  if (row.addresseeId !== userId) throw new Error('FORBIDDEN');
  if (row.status !== 'pending') throw new Error('NOT_PENDING');

  const updated = await prisma.friendship.update({
    where: { id: friendshipId },
    data: { status: accept ? 'accepted' : 'declined' },
  });

  if (accept) {
    const me = await prisma.playerProfile.findUniqueOrThrow({ where: { userId } });
    await notify({
      userId: row.requesterId,
      type: 'system',
      title: 'Ami accepté',
      body: `@${me.username} a accepté ta demande`,
      data: { friendshipId },
    });
  }
  return updated;
}

export async function blockUser(userId: string, targetUsername: string) {
  const target = await prisma.playerProfile.findUnique({ where: { username: targetUsername } });
  if (!target) throw new Error('USER_NOT_FOUND');

  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: userId, addresseeId: target.userId },
        { requesterId: target.userId, addresseeId: userId },
      ],
    },
  });
  if (existing) {
    return prisma.friendship.update({
      where: { id: existing.id },
      data: { status: 'blocked', requesterId: userId, addresseeId: target.userId },
    });
  }
  return prisma.friendship.create({
    data: { requesterId: userId, addresseeId: target.userId, status: 'blocked' },
  });
}

export async function unblockUser(userId: string, targetUsername: string) {
  const target = await prisma.playerProfile.findUnique({ where: { username: targetUsername } });
  if (!target) throw new Error('USER_NOT_FOUND');
  await prisma.friendship.deleteMany({
    where: {
      status: 'blocked',
      OR: [
        { requesterId: userId, addresseeId: target.userId },
        { requesterId: target.userId, addresseeId: userId },
      ],
    },
  });
  return { ok: true };
}

export async function setFavorite(userId: string, friendId: string, favorite: boolean) {
  if (favorite) {
    await prisma.friendFavorite.upsert({
      where: { userId_friendId: { userId, friendId } },
      create: { userId, friendId },
      update: {},
    });
  } else {
    await prisma.friendFavorite.deleteMany({ where: { userId, friendId } });
  }
  return { ok: true };
}

export async function listFriends(userId: string) {
  const rows = await prisma.friendship.findMany({
    where: {
      status: 'accepted',
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
    include: {
      requester: { include: { profile: true } },
      addressee: { include: { profile: true } },
    },
  });

  const favorites = await prisma.friendFavorite.findMany({ where: { userId } });
  const favSet = new Set(favorites.map((f) => f.friendId));

  const friends = rows.map((r) => {
    const other = r.requesterId === userId ? r.addressee : r.requester;
    return {
      friendshipId: r.id,
      userId: other.id,
      username: other.profile?.username,
      displayName: other.profile?.displayName,
      avatarUrl: other.profile?.avatarUrl,
      countryCode: other.profile?.countryCode,
      level: other.profile?.level,
      favorite: favSet.has(other.id),
    };
  });

  const presence = await getPresences(friends.map((f) => f.userId));
  const presenceMap = new Map(presence.map((p) => [p!.userId, p]));

  return friends
    .map((f) => ({ ...f, presence: presenceMap.get(f.userId) }))
    .sort((a, b) => Number(b.favorite) - Number(a.favorite));
}

export async function listPending(userId: string) {
  const incoming = await prisma.friendship.findMany({
    where: { addresseeId: userId, status: 'pending' },
    include: { requester: { include: { profile: true } } },
  });
  return incoming.map((r) => ({
    friendshipId: r.id,
    from: {
      userId: r.requesterId,
      username: r.requester.profile?.username,
      displayName: r.requester.profile?.displayName,
      countryCode: r.requester.profile?.countryCode,
    },
  }));
}

export async function areFriends(a: string, b: string) {
  const row = await prisma.friendship.findFirst({
    where: {
      status: 'accepted',
      OR: [
        { requesterId: a, addresseeId: b },
        { requesterId: b, addresseeId: a },
      ],
    },
  });
  return Boolean(row);
}

export async function isBlocked(a: string, b: string) {
  const row = await prisma.friendship.findFirst({
    where: {
      status: 'blocked',
      OR: [
        { requesterId: a, addresseeId: b },
        { requesterId: b, addresseeId: a },
      ],
    },
  });
  return Boolean(row);
}

export { pairKey };
