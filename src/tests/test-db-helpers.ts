import { prisma } from '../infrastructure/prisma.js';

/** Полная очистка БД в порядке FK */
export async function clearDatabase(): Promise<void> {
  await prisma.gamePlayerResponse.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.game.deleteMany();
  await prisma.playerOrganizer.deleteMany();
  await prisma.organizer.deleteMany();
  await prisma.userNotificationPreferences.deleteMany();
  await prisma.user.deleteMany();
}

export async function createTestOrganizer(telegramId: bigint, name: string, title: string) {
  const user = await prisma.user.create({
    data: { telegramId, name }
  });
  const organizer = await prisma.organizer.create({
    data: { userId: user.id, title }
  });
  return { user, organizer };
}
