import { PrismaClient } from '@prisma/client';
import { ludoModule } from '@nexplay/game-ludo';

const prisma = new PrismaClient();

async function main() {
  await prisma.gameDefinition.upsert({
    where: { id: ludoModule.id },
    create: {
      id: ludoModule.id,
      name: ludoModule.name,
      minPlayers: ludoModule.minPlayers,
      maxPlayers: ludoModule.maxPlayers,
      kind: 'INTEGRATED',
      isEnabled: true,
      configJson: JSON.stringify({ modes: ludoModule.modes }),
    },
    update: {
      name: ludoModule.name,
      minPlayers: ludoModule.minPlayers,
      maxPlayers: ludoModule.maxPlayers,
      configJson: JSON.stringify({ modes: ludoModule.modes }),
      isEnabled: true,
    },
  });

  const future = [
    { id: 'checkers', name: 'Dames', min: 2, max: 2 },
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
  ];
  for (const b of badges) {
    await prisma.badge.upsert({
      where: { code: b.code },
      create: b,
      update: { name: b.name, description: b.description },
    });
  }

  // Saison active couvrant la date courante (2026)
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

  // Saison 1 archivée
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

  console.log('Seed OK — Ludo, saison S2-2026 active, catalogue jeux + e-sport externe');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
