import type { PrismaClient } from '@prisma/client';
import type { JoinGamePriorityContextReader } from '../../../contracts/src/index.js';

export class PrismaJoinGamePriorityContextReader implements JoinGamePriorityContextReader {
  constructor(private readonly db: PrismaClient) {}

  async findGameJoinSnapshot(
    gameId: string
  ): Promise<{ status: string; organizerId: string; startsAt: Date; createdAt: Date } | null> {
    return this.db.game.findUnique({
      where: { id: gameId },
      select: { status: true, organizerId: true, startsAt: true, createdAt: true },
    });
  }

  async listConfirmedPlayerIdsForOrganizer(organizerId: string): Promise<string[]> {
    const rows = await this.db.playerOrganizer.findMany({
      where: { organizerId, status: 'confirmed' },
      select: { playerId: true },
    });
    return rows.map(r => r.playerId);
  }

  async listGamePlayerResponsesForPlayers(
    gameId: string,
    playerIds: string[]
  ): Promise<Array<{ response: string }>> {
    if (playerIds.length === 0) return [];
    const rows = await this.db.gamePlayerResponse.findMany({
      where: { gameId, playerId: { in: playerIds } },
      select: { response: true },
    });
    return rows.map(r => ({ response: r.response }));
  }

  async hasConfirmedPlayerOrganizerRelation(playerUserId: string, organizerId: string): Promise<boolean> {
    const row = await this.db.playerOrganizer.findFirst({
      where: { playerId: playerUserId, organizerId, status: 'confirmed' },
      select: { id: true },
    });
    return row !== null;
  }

  async isUserOrganizerByOrganizerRecord(organizerId: string, playerUserId: string): Promise<boolean> {
    const org = await this.db.organizer.findFirst({
      where: { id: organizerId, userId: playerUserId },
      select: { id: true },
    });
    return org !== null;
  }
}
