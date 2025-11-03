import { PrismaClient } from '@prisma/client';

// Re-export Prisma types for better type safety
export type User = {
  id: string;
  telegramId: bigint;
  name: string;
  levelTag: string | null;
  createdAt: Date;
};

export type Organizer = {
  id: string;
  userId: string;
  title: string | null;
  description: string | null;
};

export type Game = {
  id: string;
  organizerId: string;
  venueId: string;
  startsAt: Date;
  capacity: number;
  levelTag: string | null;
  priceText: string | null;
  status: GameStatus;
  createdAt: Date;
};

export type Registration = {
  id: string;
  gameId: string;
  userId: string;
  status: RegStatus;
  paymentStatus: PaymentStatus;
  paymentMarkedAt: Date | null;
  createdAt: Date;
};

export type GameStatus = 'open' | 'closed' | 'finished' | 'canceled';
export type RegStatus = 'confirmed' | 'waitlisted' | 'canceled';
export type PaymentStatus = 'unpaid' | 'paid';

// Extended types with relations
export type UserWithOrganizer = User & {
  organizer?: Organizer | null;
};

export type GameWithRelations = Game & {
  organizer: Organizer & {
    user: User;
  };
  registrations: (Registration & {
    user: User;
  })[];
};

export type RegistrationWithRelations = Registration & {
  game: Game;
  user: User;
};

// Repository interfaces with proper typing
export interface TypedGameRepo {
  findById(id: string): Promise<Game | null>;
  countConfirmed(gameId: string): Promise<number>;
  insertGame(g: Game): Promise<void>;
  updateStatus(gameId: string, status: GameStatus): Promise<void>;
  transaction<T>(fn: () => Promise<T>): Promise<T>;
  getOrganizerByUserId(userId: string): Promise<Organizer | null>;
}

export interface TypedRegistrationRepo {
  get(gameId: string, userId: string): Promise<Registration | null>;
  upsert(reg: Registration): Promise<void>;
  firstWaitlisted(gameId: string): Promise<Registration | null>;
  promoteToConfirmed(regId: string): Promise<void>;
}

// Prisma client instance type
export type PrismaClientType = PrismaClient;

// Helper types for domain objects
export interface CreateGameData {
  organizerId: string;
  venueId: string;
  startsAt: Date;
  capacity: number;
  levelTag?: string;
  priceText?: string;
}

export interface CreateRegistrationData {
  gameId: string;
  userId: string;
  status: RegStatus;
}