import type { DayTime, WeekDay } from '../../../../bot-racket/src/profile-setup/types.js';

export type CatalogSport = 'volleyball' | 'tennis';

export const CATALOG_SPORTS: CatalogSport[] = ['volleyball', 'tennis'];

export const DEFAULT_VOLLEYBALL_LEVEL_CODE = 'novice' as const;

export type VolleyballUiPhase = 'fmt' | 'lvl' | 'wd' | 'tm' | 'org';

export type VolleyballFormatKey = 'classic' | 'beach';

export type DemoGender = 'men' | 'women';

export const VOLLEYBALL_LEVEL_LABELS: Record<string, string> = {
  novice: 'Новичок',
  amateur: 'Любитель',
  experienced: 'Опытный',
  pro: 'Профи',
};

export const VOLLEYBALL_FORMAT_DB: Record<VolleyballFormatKey, string> = {
  classic: 'classic',
  beach: 'beach',
};

export const VOLLEYBALL_FORMAT_SUMMARY: Record<VolleyballFormatKey, string> = {
  classic: 'классика',
  beach: 'пляжный',
};

export const WEEK_DAYS_ALL: WeekDay[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export const DAY_TIME_KEYBOARD_ROWS: DayTime[][] = [
  ['nine-am', 'ten-am', 'eleven-am'],
  ['twelve-am', 'thirteen-pm', 'fourteen-pm'],
  ['fifteen-pm', 'sixteen-pm', 'seventeen-pm'],
  ['eighteen-pm', 'nineteen-pm', 'twenty-pm'],
];

export const WEEK_DAY_KEYBOARD_ROWS: WeekDay[][] = [
  ['monday', 'tuesday'],
  ['wednesday', 'thursday'],
  ['friday', 'saturday'],
  ['sunday'],
];

export const VOLLEYBALL_LEVEL_OPTIONS: { key: string; label: string }[] = [
  { key: 'novice', label: VOLLEYBALL_LEVEL_LABELS.novice! },
  { key: 'amateur', label: VOLLEYBALL_LEVEL_LABELS.amateur! },
  { key: 'experienced', label: VOLLEYBALL_LEVEL_LABELS.experienced! },
  { key: 'pro', label: VOLLEYBALL_LEVEL_LABELS.pro! },
];

/** Сколько организаторов достаточно, чтобы показать шаг выбора. */
export const ORGANIZER_LOOKUP_LIMIT = 1;

export const TELEGRAM_CB_TOAST_MAX_LEN = 200;

export const TELEGRAM_CB_TOAST_TRUNCATE_SUFFIX = '...';
