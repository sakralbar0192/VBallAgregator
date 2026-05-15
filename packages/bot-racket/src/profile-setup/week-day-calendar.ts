import type { WeekDay } from './types.js';

/** Порядок дней недели (календарный) — для сортировки выбранных дней и шагов времени. */
export const WEEKDAY_CALENDAR_ORDER: WeekDay[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const rank = new Map(WEEKDAY_CALENDAR_ORDER.map((d, i) => [d, i]));

export function sortWeekDaysCalendar(days: WeekDay[]): WeekDay[] {
  return [...days].sort((a, b) => (rank.get(a) ?? 99) - (rank.get(b) ?? 99));
}
