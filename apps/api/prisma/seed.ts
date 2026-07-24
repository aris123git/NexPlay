import { PrismaClient } from '@prisma/client';
import { ludoModule } from '@nexplay/game-ludo';
import { damesModule } from '@nexplay/game-dames';
import { generateNexplayId } from '../src/identity/nexplay-id.js';

const prisma = new PrismaClient();

async function upsertIntegrated(mod: {
  id: string;
  name: string;
  minPlayers: number;
  maxPlayers: number;
  modes: unknown;
}) {
  await prisma.gameDefinition.upsert({
    where: { id: mod.id },
    create: {
      id: mod.id,
      name: mod.name,
      minPlayers: mod.minPlayers,
      maxPlayers: mod.maxPlayers,
      kind: 'INTEGRATED',
      isEnabled: true,
      configJson: JSON.stringify({ modes: mod.modes }),
    },
    update: {
      name: mod.name,
      minPlayers: mod.minPlayers,
      maxPlayers: mod.maxPlayers,
      configJson: JSON.stringify({ modes: mod.modes }),
      isEnabled: true,
      kind: 'INTEGRATED',
    },
  });
}

async function main() {
  await upsertIntegrated(ludoModule);
  await upsertIntegrated(damesModule);

  // Ancien id catalogue « checkers » → désactivé au profit de dames
  await prisma.gameDefinition.updateMany({
    where: { id: 'checkers' },
    data: { isEnabled: false },
  });

  const future = [
    { id: 'chess', name: 'Échecs', min: 2, max: 2 },
    { id: 'awale', name: 'Awalé', min: 2, max: 2 },
    { id: 'domino', name: 'Dominos', min: 2, max: 4 },
    { id: 'uno', name: 'Uno', min: 2, max: 4 },
    { id: 'cod-mobile', name: 'Call of Duty Mobile', min: 2, max: 10 },
    { id: 'free-fire', name: 'Free Fire', min: 2, max: 8 },
    { id: 'pubg', name: 'PUBG Mobile', min: 2, max: 8 },
    { id: 'ea-fc', name: 'EA Sports FC', min: 2, max: 2 },
  ];
  for (const g of future) {
    const isExternal = ['cod-mobile', 'free-fire', 'pubg', 'ea-fc'].includes(g.id);
    await prisma.gameDefinition.upsert({
      where: { id: g.id },
      create: {
        id: g.id,
        name: g.name,
        minPlayers: g.min,
        maxPlayers: g.max,
        kind: isExternal ? 'EXTERNAL' : 'INTEGRATED',
        isEnabled: false,
        configJson: '{}',
      },
      update: {
        kind: isExternal ? 'EXTERNAL' : 'INTEGRATED',
      },
    });
  }

  const badges = [
    {
      code: 'first_win',
      name: 'Première victoire',
      description: 'Gagnez votre première partie sur NexPlay',
    },
    {
      code: 'season_warrior',
      name: 'Guerrier de saison',
      description: 'Jouez 10 parties pendant une saison',
    },
    {
      code: 'clan_founder',
      name: 'Fondateur de clan',
      description: 'Créez un clan NexPlay',
    },
    {
      code: 'dames_first_win',
      name: 'Roi des dames',
      description: 'Gagnez votre première partie de Dames',
    },
  ];
  for (const b of badges) {
    await prisma.badge.upsert({
      where: { code: b.code },
      create: b,
      update: { name: b.name, description: b.description },
    });
  }

  const startsAt = new Date('2026-07-01T00:00:00.000Z');
  const endsAt = new Date('2026-09-30T23:59:59.000Z');
  await prisma.season.upsert({
    where: { code: 'S2-2026' },
    create: {
      code: 'S2-2026',
      name: 'Saison 2 — Hivernage',
      startsAt,
      endsAt,
      status: 'active',
      rewardsJson: JSON.stringify({
        top1: { nexCoins: 2000, title: 'Champion NexPlay' },
        top10: { nexCoins: 500 },
      }),
    },
    update: { status: 'active', name: 'Saison 2 — Hivernage', startsAt, endsAt },
  });

  await prisma.season.upsert({
    where: { code: 'S1-2026' },
    create: {
      code: 'S1-2026',
      name: 'Saison 1 — Harmattan',
      startsAt: new Date('2026-01-01T00:00:00.000Z'),
      endsAt: new Date('2026-03-31T23:59:59.000Z'),
      status: 'completed',
      rewardsJson: '{}',
    },
    update: { status: 'completed' },
  });

  console.log('Seed OK — Ludo + Dames, saison S2-2026, catalogue');

  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@nexplay.local';
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
    include: { profile: true },
  });
  if (!existingAdmin) {
    const argon2 = await import('argon2');
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: await argon2.hash('adminadmin'),
        role: 'admin',
        profile: {
          create: {
            username: 'nexplay_admin',
            displayName: 'NexPlay Admin',
            nexplayId: generateNexplayId(),
            countryCode: 'BF',
            continentCode: 'AF',
            timezone: 'Africa/Ouagadougou',
            avatarUrl: 'preset://shield',
          },
        },
        wallet: { create: { nexCoins: 10000 } },
      },
    });
    console.log(`Admin créé: ${adminEmail} / adminadmin`);
  } else if (existingAdmin.role !== 'admin') {
    await prisma.user.update({
      where: { id: existingAdmin.id },
      data: { role: 'admin' },
    });
  }

  // Backfill NexPlay ID pour profils existants
  const allProfiles = await prisma.playerProfile.findMany({
    select: { userId: true, nexplayId: true },
  });
  for (const p of allProfiles) {
    if (!p.nexplayId || !/^NXP-[0-9A-F]{4}-[0-9A-F]{4}$/i.test(p.nexplayId)) {
      let id = generateNexplayId();
      for (let i = 0; i < 5; i++) {
        const clash = await prisma.playerProfile.findUnique({ where: { nexplayId: id } });
        if (!clash) break;
        id = generateNexplayId();
      }
      await prisma.playerProfile.update({
        where: { userId: p.userId },
        data: { nexplayId: id },
      });
    }
  }

  const { seedShopCatalog } = await import('../src/shop/service.js');
  const { seedChallenges } = await import('../src/events/service.js');
  await seedShopCatalog();
  await seedChallenges();
  console.log('Shop + défis seedés · NexPlay IDs OK');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
