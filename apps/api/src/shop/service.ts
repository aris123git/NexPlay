import { prisma } from '../db.js';
import { creditCoins } from '../wallet/service.js';

export type Equipped = {
  avatar?: string;
  frame?: string;
  emote?: string;
  badge?: string;
  dice_skin?: string;
  board?: string;
  sfx?: string;
  anim?: string;
};

/** Catalogue cosmétique — aucun effet sur les règles de jeu */
export const DEFAULT_CATALOG: {
  sku: string;
  category: string;
  nameKey: string;
  descriptionKey: string;
  priceCoins: number;
  rarity: string;
  metaJson: string;
}[] = [
  { sku: 'avatar.falcon', category: 'avatar', nameKey: 'shop.avatar.falcon', descriptionKey: 'shop.avatar.falcon.desc', priceCoins: 150, rarity: 'rare', metaJson: '{"preset":"falcon"}' },
  { sku: 'avatar.mask', category: 'avatar', nameKey: 'shop.avatar.mask', descriptionKey: 'shop.avatar.mask.desc', priceCoins: 200, rarity: 'epic', metaJson: '{"preset":"mask"}' },
  { sku: 'frame.gold', category: 'frame', nameKey: 'shop.frame.gold', descriptionKey: 'shop.frame.gold.desc', priceCoins: 300, rarity: 'epic', metaJson: '{"color":"#d4a017"}' },
  { sku: 'frame.sahel', category: 'frame', nameKey: 'shop.frame.sahel', descriptionKey: 'shop.frame.sahel.desc', priceCoins: 180, rarity: 'rare', metaJson: '{"color":"#c4783a"}' },
  { sku: 'emote.gg', category: 'emote', nameKey: 'shop.emote.gg', descriptionKey: 'shop.emote.gg.desc', priceCoins: 80, rarity: 'common', metaJson: '{"emoji":"👏"}' },
  { sku: 'emote.fire', category: 'emote', nameKey: 'shop.emote.fire', descriptionKey: 'shop.emote.fire.desc', priceCoins: 80, rarity: 'common', metaJson: '{"emoji":"🔥"}' },
  { sku: 'badge.vip', category: 'badge', nameKey: 'shop.badge.vip', descriptionKey: 'shop.badge.vip.desc', priceCoins: 500, rarity: 'legendary', metaJson: '{"label":"VIP"}' },
  { sku: 'dice.gold', category: 'dice_skin', nameKey: 'shop.dice.gold', descriptionKey: 'shop.dice.gold.desc', priceCoins: 250, rarity: 'epic', metaJson: '{"theme":"gold"}' },
  { sku: 'dice.baobab', category: 'dice_skin', nameKey: 'shop.dice.baobab', descriptionKey: 'shop.dice.baobab.desc', priceCoins: 220, rarity: 'rare', metaJson: '{"theme":"wood"}' },
  { sku: 'board.night', category: 'board', nameKey: 'shop.board.night', descriptionKey: 'shop.board.night.desc', priceCoins: 350, rarity: 'epic', metaJson: '{"theme":"night"}' },
  { sku: 'board.sahel', category: 'board', nameKey: 'shop.board.sahel', descriptionKey: 'shop.board.sahel.desc', priceCoins: 280, rarity: 'rare', metaJson: '{"theme":"sahel"}' },
  { sku: 'sfx.drum', category: 'sfx', nameKey: 'shop.sfx.drum', descriptionKey: 'shop.sfx.drum.desc', priceCoins: 120, rarity: 'rare', metaJson: '{"pack":"drum"}' },
  { sku: 'anim.confetti', category: 'anim', nameKey: 'shop.anim.confetti', descriptionKey: 'shop.anim.confetti.desc', priceCoins: 160, rarity: 'rare', metaJson: '{"fx":"confetti"}' },
];

export async function seedShopCatalog() {
  for (const item of DEFAULT_CATALOG) {
    await prisma.shopItem.upsert({
      where: { sku: item.sku },
      create: item,
      update: {
        priceCoins: item.priceCoins,
        isActive: true,
        nameKey: item.nameKey,
        descriptionKey: item.descriptionKey,
      },
    });
  }
}

export async function listShop(category?: string) {
  return prisma.shopItem.findMany({
    where: {
      isActive: true,
      ...(category ? { category } : {}),
    },
    orderBy: [{ category: 'asc' }, { priceCoins: 'asc' }],
  });
}

export async function getInventory(userId: string) {
  const rows = await prisma.playerInventory.findMany({
    where: { userId },
    include: { item: true },
    orderBy: { acquiredAt: 'desc' },
  });
  const profile = await prisma.playerProfile.findUniqueOrThrow({
    where: { userId },
  });
  return {
    items: rows.map((r) => ({
      ...r.item,
      acquiredAt: r.acquiredAt,
      source: r.source,
    })),
    equipped: JSON.parse(profile.equippedJson || '{}') as Equipped,
  };
}

export async function purchaseItem(userId: string, sku: string) {
  const item = await prisma.shopItem.findUnique({ where: { sku } });
  if (!item || !item.isActive) throw new Error('ITEM_NOT_FOUND');

  const owned = await prisma.playerInventory.findUnique({
    where: { userId_itemId: { userId, itemId: item.id } },
  });
  if (owned) throw new Error('ALREADY_OWNED');

  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet || wallet.nexCoins < item.priceCoins) throw new Error('INSUFFICIENT_FUNDS');

  await creditCoins(userId, -item.priceCoins, 'purchase', { sku: item.sku });
  await prisma.playerInventory.create({
    data: { userId, itemId: item.id, source: 'shop' },
  });

  return { item, spent: item.priceCoins };
}

export async function equipItem(userId: string, sku: string) {
  const item = await prisma.shopItem.findUnique({ where: { sku } });
  if (!item) throw new Error('ITEM_NOT_FOUND');
  const owned = await prisma.playerInventory.findUnique({
    where: { userId_itemId: { userId, itemId: item.id } },
  });
  if (!owned) throw new Error('NOT_OWNED');

  const profile = await prisma.playerProfile.findUniqueOrThrow({ where: { userId } });
  const equipped = JSON.parse(profile.equippedJson || '{}') as Equipped;
  const slot = item.category as keyof Equipped;
  equipped[slot] = item.sku;

  // Avatar preset sync
  if (item.category === 'avatar') {
    const meta = JSON.parse(item.metaJson || '{}') as { preset?: string };
    if (meta.preset) {
      await prisma.playerProfile.update({
        where: { userId },
        data: {
          equippedJson: JSON.stringify(equipped),
          avatarUrl: `preset://${meta.preset}`,
        },
      });
      return { equipped };
    }
  }

  await prisma.playerProfile.update({
    where: { userId },
    data: { equippedJson: JSON.stringify(equipped) },
  });
  return { equipped };
}

export async function unequipSlot(userId: string, category: string) {
  const profile = await prisma.playerProfile.findUniqueOrThrow({ where: { userId } });
  const equipped = JSON.parse(profile.equippedJson || '{}') as Equipped;
  delete equipped[category as keyof Equipped];
  await prisma.playerProfile.update({
    where: { userId },
    data: { equippedJson: JSON.stringify(equipped) },
  });
  return { equipped };
}
