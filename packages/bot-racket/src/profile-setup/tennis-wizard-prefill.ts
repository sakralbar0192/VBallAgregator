import { prisma } from '../../../core/src/infrastructure/prisma.js';
import DayTimeService from './services/day-time.js';
import PlayLevelService from './services/play-level.js';
import PreferredAgeService from './services/prefer-age.js';
import PreferredGenderService from './services/prefer-gender.js';
import type {
  DayTime,
  PlayLevel,
  PlayerAge,
  PlayerGender,
  PreferredAge,
  PreferredGender,
  WeekDay,
  WizardState,
} from './types.js';
import { WEEKDAY_CALENDAR_ORDER } from './week-day-calendar.js';

const VALID_DAY_TIMES = new Set(Object.keys(DayTimeService.timeOfDay) as DayTime[]);

/** Часы из UI (`10:00`) → ключ слота мастера (`ten-am`). */
const CLOCK_TO_DAY_TIME: Map<string, DayTime> = (() => {
  const m = new Map<string, DayTime>();
  for (const [key, clock] of Object.entries(DayTimeService.timeOfDay) as [DayTime, string][]) {
    const norm = clock.trim().toLowerCase();
    m.set(norm, key);
    const [h, min] = norm.split(':');
    if (h && min !== undefined) {
      const hNum = parseInt(h, 10);
      if (!Number.isNaN(hNum)) {
        m.set(`${hNum}:${min}`, key);
      }
    }
  }
  return m;
})();

function splitPreferenceTokens(raw: string): string[] {
  return raw
    .split(/[,;|/\n]+/)
    .map(s => s.trim())
    .filter(Boolean);
}

function parseDayTimeToken(t: string): DayTime | null {
  const s = t.trim();
  if (!s) return null;
  if (VALID_DAY_TIMES.has(s as DayTime)) return s as DayTime;
  const clockKey = s.toLowerCase().replace(/\s+/g, '');
  const fromClock = CLOCK_TO_DAY_TIME.get(clockKey);
  if (fromClock) return fromClock;
  return null;
}

function parseDaySlots(raw: string | null | undefined): DayTime[] {
  if (!raw?.trim()) return [];
  const out: DayTime[] = [];
  const seen = new Set<DayTime>();
  for (const part of splitPreferenceTokens(raw)) {
    for (const sub of part.split(/\s+/).map(x => x.trim()).filter(Boolean)) {
      const dt = parseDayTimeToken(sub.replace(/^[,;]+|[,;]+$/g, ''));
      if (dt && !seen.has(dt)) {
        seen.add(dt);
        out.push(dt);
      }
    }
  }
  return out;
}

function mapGenderToken(t: string): PreferredGender | null {
  const s = t.trim().toLowerCase();
  if (!s) return null;
  if (s === 'all' || s === 'любой' || s === 'любая') return 'all';
  if (s === 'women' || s === 'woman' || s === 'female' || s === 'женщины' || s === 'женский') return 'women';
  if (s === 'men' || s === 'man' || s === 'male' || s === 'мужчины' || s === 'мужской') return 'men';
  for (const key of PreferredGenderService.preferredGenderKeys as PlayerGender[]) {
    const info = PreferredGenderService.preferredGenders[key];
    if (info.name.toLowerCase() === s || info.shortName.toLowerCase() === s) return key;
  }
  return PreferredGenderService.isPreferredGenderValid(s) ? (s as PreferredGender) : null;
}

function mapAgeToken(t: string): PreferredAge | null {
  const s = t.trim().toLowerCase();
  if (!s) return null;
  if (s === 'all' || s === 'любой' || s === 'любая') return 'all';
  for (const key of PreferredAgeService.preferredAgeKeys as PlayerAge[]) {
    const info = PreferredAgeService.preferredAges[key];
    if (info.name.toLowerCase() === s || info.shortName.toLowerCase().replace(/\s+/g, '') === s.replace(/\s+/g, ''))
      return key;
  }
  return PreferredAgeService.isPreferredAgeValid(s) ? (s as PreferredAge) : null;
}

function parsePlayLevelFromProfile(playLevelCode: string | null | undefined, playLevel: string | null | undefined): PlayLevel | undefined {
  if (playLevelCode && PlayLevelService.isLevelValid(playLevelCode)) return playLevelCode as PlayLevel;
  const readable = playLevel?.trim().toLowerCase();
  if (!readable) return undefined;
  for (const key of PlayLevelService.playLevelKeys) {
    if (PlayLevelService.playLevels[key].toLowerCase() === readable) return key;
  }
  return undefined;
}

/**
 * Заполняет состояние мастера тенниса из БД (редактирование профиля — кнопки с ✅).
 */
export async function applyTennisWizardStateFromDb(state: WizardState, telegramId: number): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(telegramId) } });
  if (!user) return false;

  const profile = await prisma.matchingProfile.findUnique({
    where: { userId_sport: { userId: user.id, sport: 'tennis' } },
  });
  const sched = await prisma.matchingSchedule.findUnique({
    where: { userId_sport: { userId: user.id, sport: 'tennis' } },
  });

  if (!profile && !sched) return false;

  const levelFromDb = parsePlayLevelFromProfile(profile?.playLevelCode ?? undefined, profile?.playLevel ?? undefined);
  if (levelFromDb) state.level = levelFromDb;

  const gRaw = (profile?.preferredGenders ?? '').trim();
  if (gRaw) {
    const genders = splitPreferenceTokens(gRaw).map(mapGenderToken).filter((g): g is PreferredGender => g !== null);
    if (genders.length) state.preferGenders = genders;
  }

  const aRaw = (profile?.preferredAges ?? '').trim();
  if (aRaw) {
    const ages = splitPreferenceTokens(aRaw).map(mapAgeToken).filter((a): a is PreferredAge => a !== null);
    if (ages.length) state.preferAges = ages;
  }

  if (sched) {
    const dayTimes = {} as Record<WeekDay, DayTime[]>;
    const selectedDays: WeekDay[] = [];
    for (const day of WEEKDAY_CALENDAR_ORDER) {
      const col = sched[day] as string | null;
      const slots = parseDaySlots(col);
      if (slots.length) {
        dayTimes[day] = slots;
        selectedDays.push(day);
      }
    }
    if (selectedDays.length) {
      state.selectedDays = selectedDays;
      state.dayTimes = dayTimes;
    }
  }

  return Boolean(profile || sched);
}
