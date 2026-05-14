/**
 * Константы для уровней игры, мест проведения, статусов записи и оплаты
 * Централизованное хранение идентификаторов и их человеко-читаемых названий
 */

export const VENUE_IDS = {
  CHAIKA: 'venue-chaika-id',
  FOK: 'venue-fok-id',
  FIFTH_SCHOOL: 'venue-5th-school-id',
} as const;

export const VENUE_NAMES = {
  [VENUE_IDS.CHAIKA]: '🏟️ "Чайка"',
  [VENUE_IDS.FOK]: '🏟️ "ФОК"',
  [VENUE_IDS.FIFTH_SCHOOL]: '🏟️ 5-ая школа',
} as const;

export const GAME_LEVELS = {
  BEGINNER: 'beginner',
  AMATEUR: 'amateur',
  PROFESSIONAL: 'professional',
} as const;

export const GAME_LEVEL_NAMES = {
  [GAME_LEVELS.BEGINNER]: 'Новичок',
  [GAME_LEVELS.AMATEUR]: 'Любитель',
  [GAME_LEVELS.PROFESSIONAL]: 'Профи',
} as const;

export const REGISTRATION_STATUSES = {
  CONFIRMED: 'confirmed',
  WAITLISTED: 'waitlisted',
  CANCELED: 'canceled',
} as const;

export const REGISTRATION_STATUS_NAMES = {
  [REGISTRATION_STATUSES.CONFIRMED]: '✅ Подтвержден',
  [REGISTRATION_STATUSES.WAITLISTED]: '⏳ В ожидании',
  [REGISTRATION_STATUSES.CANCELED]: '❌ Отменен',
} as const;

export const PAYMENT_STATUSES = {
  PAID: 'paid',
  UNPAID: 'unpaid',
} as const;

export const PAYMENT_STATUS_NAMES = {
  [PAYMENT_STATUSES.PAID]: '💰 Оплачено',
  [PAYMENT_STATUSES.UNPAID]: '⏳ Не оплачено',
} as const;

export const GAME_STATUSES = {
  OPEN: 'open',
  CLOSED: 'closed',
  FINISHED: 'finished',
  CANCELED: 'canceled',
} as const;

export const GAME_STATUS_NAMES = {
  [GAME_STATUSES.OPEN]: '🟢 Открыта',
  [GAME_STATUSES.CLOSED]: '🔴 Закрыта',
  [GAME_STATUSES.FINISHED]: '✅ Завершена',
  [GAME_STATUSES.CANCELED]: '❌ Отменена',
} as const;

/**
 * Получить название места по его ID
 */
export function getVenueName(venueId: string): string {
  return VENUE_NAMES[venueId as keyof typeof VENUE_NAMES] || venueId;
}

/**
 * Получить название уровня по его ID
 */
export function getLevelName(levelTag?: string): string {
  if (!levelTag) return '';
  return GAME_LEVEL_NAMES[levelTag as keyof typeof GAME_LEVEL_NAMES] || levelTag;
}

/**
 * Получить название статуса записи по его ID
 */
export function getRegistrationStatusName(status: string): string {
  return REGISTRATION_STATUS_NAMES[status as keyof typeof REGISTRATION_STATUS_NAMES] || status;
}

/**
 * Получить название статуса оплаты по его ID
 */
export function getPaymentStatusName(status: string): string {
  return PAYMENT_STATUS_NAMES[status as keyof typeof PAYMENT_STATUS_NAMES] || status;
}

/**
 * Получить название статуса игры по его ID
 */
export function getGameStatusName(status: string): string {
  return GAME_STATUS_NAMES[status as keyof typeof GAME_STATUS_NAMES] || status;
}

/**
 * Получить все доступные места проведения
 */
export function getAllVenues(): Array<{ id: string; name: string }> {
  return Object.entries(VENUE_NAMES).map(([id, name]) => ({ id, name }));
}

/**
 * Получить все доступные уровни игры
 */
export function getAllLevels(): Array<{ id: string; name: string }> {
  return Object.entries(GAME_LEVEL_NAMES).map(([id, name]) => ({ id, name }));
}

/**
 * Получить имя организатора из объекта игры
 */
export function getOrganizerName(game: any): string {
  return game.organizer?.user?.name ? `Организатор: ${game.organizer.user.name}\n` : '';
}