import { prisma } from '../../infrastructure/prisma.js';

export class GetUserRegistrationsQuery {
  constructor(public userId: string) {}

  async execute() {
    return await prisma.registration.findMany({
      where: { userId: this.userId },
      include: {
        game: {
          include: {
            organizer: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }
}