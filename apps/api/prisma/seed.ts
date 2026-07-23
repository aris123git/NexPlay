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

  // Placeholders futurs (désactivés)
  const future = [
    { id: 'checkers', name: 'Dames', min: 2, max: 2 },
    { id: 'chess', name: 'Échecs', min: 2, max: 2 },
    { id: 'awale', name: 'Awalé', min: 2, max: 2 },
    { id: 'domino', name: 'Dominos', min: 2, max: 4 },
  ];
  for (const g of future) {
    await prisma.gameDefinition.upsert({
      where: { id: g.id },
      create: {
        id: g.id,
        name: g.name,
        minPlayers: g.min,
        maxPlayers: g.max,
        kind: 'INTEGRATED',
        isEnabled: false,
        configJson: '{}',
      },
      update: {},
    });
  }

  await prisma.badge.upsert({
    where: { code: 'first_win' },
    create: {
      code: 'first_win',
      name: 'Première victoire',
      description: 'Gagnez votre première partie sur NexPlay',
    },
    update: {},
  });

  console.log('Seed OK — Ludo activé, jeux futurs en catalogue');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
