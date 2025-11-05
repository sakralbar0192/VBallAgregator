export type DomainEvent =
  | { type: 'GameCreated'; payload: { gameId: string; startsAt: string; capacity: number; levelTag?: string; priceText?: string } }
  | { type: 'GameReminder24h'; payload: { gameId: string } }
  | { type: 'GameReminder2h'; payload: { gameId: string } }
  | { type: 'PaymentReminder12h'; payload: { gameId: string } }
  | { type: 'PaymentReminder24h'; payload: { gameId: string } }
  | { type: 'SendPaymentReminders'; payload: { gameId: string; unpaidRegistrations: Array<{ userId: string; telegramId: bigint }> } }
  | { type: 'PlayerJoined'; payload: { gameId: string; userId: string; status: string } }
  | { type: 'WaitlistedPromoted'; payload: { gameId: string; userId: string } }
  | { type: 'PaymentMarked'; payload: { gameId: string; userId: string } }
  | { type: 'PaymentAttemptRejectedEarly'; payload: { gameId: string; userId: string } }
  | { type: 'RegistrationCanceled'; payload: { gameId: string; userId: string } }
  | { type: 'GameClosed'; payload: { gameId: string } }
  | { type: 'PlayerLinkedToOrganizer'; payload: { playerId: string; organizerId: string; playerName: string } }
  | { type: 'PlayerSelectedOrganizers'; payload: { playerId: string; organizerIds: string[] } }
  | { type: 'PlayerConfirmedByOrganizer'; payload: { organizerId: string; playerId: string; playerName: string } }
  | { type: 'PlayerRejectedByOrganizer'; payload: { organizerId: string; playerId: string; playerName: string } }
  | { type: 'GameCreatedWithPriorityWindow'; payload: { gameId: string; priorityWindowClosesAt: string; confirmedPlayers: Array<{ playerId: string; telegramId: bigint }> } }
  | { type: 'PlayerRespondedToGameInvitation'; payload: { gameId: string; playerId: string; response: string } }
  | { type: 'GamePublishedForAll'; payload: { gameId: string } };