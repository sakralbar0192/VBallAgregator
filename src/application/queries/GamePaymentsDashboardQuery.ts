import { prisma } from '../../infrastructure/prisma.js';

export interface GamePaymentsDashboard {
  gameId: string;
  players: Array<{
    userId: string;
    name: string;
    paymentStatus: 'paid' | 'unpaid';
    paymentMarkedAt?: Date;
  }>;
  paidCount: number;
  unpaidCount: number;
}

export class GamePaymentsDashboardQuery {
  constructor(public gameId: string, public organizerId: string) {}

  async execute(): Promise<GamePaymentsDashboard> {
    const game = await prisma.game.findUnique({
      where: { id: this.gameId, organizerId: this.organizerId },
      include: {
        registrations: {
          where: { status: 'confirmed' },
          include: { user: true },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!game) {
      throw new Error('Game not found or access denied');
    }

    const players = game.registrations.map(reg => ({
      userId: reg.userId,
      name: reg.user.name,
      paymentStatus: reg.paymentStatus as 'paid' | 'unpaid',
      paymentMarkedAt: reg.paymentMarkedAt || undefined
    }));

    const paidCount = players.filter(p => p.paymentStatus === 'paid').length;
    const unpaidCount = players.filter(p => p.paymentStatus === 'unpaid').length;

    return {
      gameId: this.gameId,
      players,
      paidCount,
      unpaidCount
    };
  }
}