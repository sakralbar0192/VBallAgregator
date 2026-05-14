/**
 * Чтение контекста для правил приоритетного окна при join.
 * Реализация остаётся в `packages/core` (Prisma) до выделения game/organizer сервисов.
 */
export interface JoinGamePriorityContextReader {
  findGameJoinSnapshot(
    gameId: string
  ): Promise<{ status: string; organizerId: string; startsAt: Date; createdAt: Date } | null>;

  listConfirmedPlayerIdsForOrganizer(organizerId: string): Promise<string[]>;

  listGamePlayerResponsesForPlayers(
    gameId: string,
    playerIds: string[]
  ): Promise<Array<{ response: string }>>;

  hasConfirmedPlayerOrganizerRelation(playerUserId: string, organizerId: string): Promise<boolean>;

  /** true если `playerUserId` — это userId организатора, владеющего записью Organizer с данным id */
  isUserOrganizerByOrganizerRecord(organizerId: string, playerUserId: string): Promise<boolean>;
}
