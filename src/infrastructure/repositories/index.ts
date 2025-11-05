// Базовый класс для репозиториев
export { BasePrismaRepository } from './base-repository.js';

// Реализации репозиториев
export { PrismaGameRepo } from './game-repository.js';
export { PrismaRegistrationRepo } from './registration-repository.js';
export { PrismaUserRepo } from './user-repository.js';
export { PrismaOrganizerRepo } from './organizer-repository.js';

// Интерфейсы репозиториев
export type { GameRepo } from './game-repository.js';
export type { RegistrationRepo } from './registration-repository.js';
export type { UserRepo } from './user-repository.js';
export type { OrganizerRepo } from './organizer-repository.js';