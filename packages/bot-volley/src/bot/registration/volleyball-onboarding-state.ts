import { prisma } from '../../../../core/src/infrastructure/prisma.js';
import { PrismaRacketMatchingPersistence } from '../../../../core/src/infrastructure/prisma-racket-matching-persistence.js';
import {
  setUserVolleyballOnboardingSummary,
  upsertUserSportProfileRow,
} from '../../../../core/src/application/use-cases.js';
import DayTimeService from '../../../../bot-racket/src/profile-setup/services/day-time.js';
import WeekDayService from '../../../../bot-racket/src/profile-setup/services/week-day.js';
import type { DayTime, WeekDay } from '../../../../bot-racket/src/profile-setup/types.js';
import { WEEKDAY_CALENDAR_ORDER, sortWeekDaysCalendar } from '../../../../bot-racket/src/profile-setup/week-day-calendar.js';
import {
  DEFAULT_VOLLEYBALL_LEVEL_CODE,
  VOLLEYBALL_FORMAT_DB,
  VOLLEYBALL_FORMAT_SUMMARY,
  VOLLEYBALL_LEVEL_LABELS,
  WEEK_DAYS_ALL,
  type VolleyballFormatKey,
  type VolleyballUiPhase,
} from './onboarding-constants.js';
import { OnbText } from './onboarding-text.js';
import type { OnboardingSessionData } from './onboarding-session.js';

export function levelReadable(key: string): string {
  return VOLLEYBALL_LEVEL_LABELS[key] ?? key;
}

export function emptyVolleyballFormats(): { classic: boolean; beach: boolean } {
  return { classic: false, beach: false };
}

export function resetVolleyballDraftForNewSport(data: OnboardingSessionData): void {
  data.vbFormats = emptyVolleyballFormats();
  data.vbWeekDays = [];
  data.vbDayTimes = {} as Record<WeekDay, DayTime[]>;
  data.vbCursorDay = null;
  data.vbLevelKey = undefined;
  data.vbWantOrganize = undefined;
}

export function toggleVolleyballFormat(data: OnboardingSessionData, key: VolleyballFormatKey): void {
  data.vbFormats ??= emptyVolleyballFormats();
  data.vbFormats[key] = !data.vbFormats[key];
  data.vbUiPhase = 'fmt';
}

export function hasAnyVolleyballFormat(data: OnboardingSessionData): boolean {
  return Boolean(data.vbFormats?.classic || data.vbFormats?.beach);
}

export function setVolleyballLevel(data: OnboardingSessionData, key: string): void {
  data.vbLevelKey = key;
  data.vbUiPhase = 'wd';
  data.vbWeekDays = sortWeekDaysCalendar([...(data.vbWeekDays ?? [])]);
}

export function toggleVolleyballWeekDay(data: OnboardingSessionData, day: WeekDay): void {
  data.vbWeekDays ??= [];
  data.vbUiPhase = 'wd';
  const ix = data.vbWeekDays.indexOf(day);
  if (ix >= 0) {
    data.vbWeekDays.splice(ix, 1);
    data.vbDayTimes ??= {} as Record<WeekDay, DayTime[]>;
    delete data.vbDayTimes[day];
  } else {
    data.vbWeekDays.push(day);
  }
  data.vbWeekDays = sortWeekDaysCalendar(data.vbWeekDays);
}

export function beginVolleyballTimeWalk(data: OnboardingSessionData): void {
  data.vbWeekDays = sortWeekDaysCalendar(data.vbWeekDays ?? []);
  data.vbCursorDay = data.vbWeekDays[0] ?? null;
  data.vbUiPhase = 'tm';
}

export function clearVolleyballTimeForDay(data: OnboardingSessionData, day: WeekDay): void {
  data.vbDayTimes ??= {} as Record<WeekDay, DayTime[]>;
  delete data.vbDayTimes[day];
}

export function toggleVolleyballTimeSlot(data: OnboardingSessionData, day: WeekDay, slot: DayTime): void {
  data.vbDayTimes ??= {} as Record<WeekDay, DayTime[]>;
  const arr = data.vbDayTimes[day] ?? [];
  const ix = arr.indexOf(slot);
  if (ix >= 0) arr.splice(ix, 1);
  else arr.push(slot);
  data.vbDayTimes[day] = arr;
}

export function volleyballTimesForDay(data: OnboardingSessionData, day: WeekDay): DayTime[] {
  return [...(data.vbDayTimes?.[day] ?? [])];
}

export function advanceVolleyballTimeCursor(data: OnboardingSessionData, currentDay: WeekDay): WeekDay | null {
  const days = data.vbWeekDays ?? [];
  const idx = days.indexOf(currentDay);
  return days[idx + 1] ?? null;
}

export function setVolleyballUiPhase(data: OnboardingSessionData, phase: VolleyballUiPhase): void {
  data.vbUiPhase = phase;
}

export function orderedDayTimes(data: OnboardingSessionData): Record<WeekDay, DayTime[]> {
  const dayTimes = data.vbDayTimes ?? ({} as Record<WeekDay, DayTime[]>);
  const ordered = {} as Record<WeekDay, DayTime[]>;
  for (const day of WEEKDAY_CALENDAR_ORDER) {
    const slots = dayTimes[day];
    if (slots?.length) ordered[day] = slots;
  }
  return ordered;
}

export function buildVolleyballProfileCompletionMessage(data: OnboardingSessionData): string {
  const fmt: string[] = [];
  if (data.vbFormats?.classic) fmt.push(VOLLEYBALL_FORMAT_SUMMARY.classic);
  if (data.vbFormats?.beach) fmt.push(VOLLEYBALL_FORMAT_SUMMARY.beach);
  const daysSorted = sortWeekDaysCalendar([...(data.vbWeekDays ?? [])]);
  const times = DayTimeService.getReadableDayTimeInfo(orderedDayTimes(data)).trim();
  const org =
    data.vbWantOrganize === true
      ? OnbText.organizeYes
      : data.vbWantOrganize === false
        ? OnbText.organizeNo
        : OnbText.summaryEmpty;
  return (
    OnbText.vbSummaryTitle +
    OnbText.vbSummaryFormats(fmt.join(' и ') || OnbText.summaryEmpty) +
    OnbText.vbSummaryLevel(levelReadable(data.vbLevelKey ?? '')) +
    OnbText.vbSummaryDays(WeekDayService.getReadableWeekDayInfo(daysSorted)) +
    OnbText.vbSummaryTimes(times) +
    OnbText.vbSummaryOrganize(org)
  );
}

export async function persistVolleyballProfile(userId: string, data: OnboardingSessionData): Promise<void> {
  const formats: string[] = [];
  if (data.vbFormats?.classic) formats.push(VOLLEYBALL_FORMAT_DB.classic);
  if (data.vbFormats?.beach) formats.push(VOLLEYBALL_FORMAT_DB.beach);
  if (data.vbWeekDays?.length) {
    data.vbWeekDays = sortWeekDaysCalendar(data.vbWeekDays);
  }
  const selectedDays = data.vbWeekDays ?? [];
  const dayTimes = data.vbDayTimes ?? ({} as Record<WeekDay, DayTime[]>);
  const dayTimesOrdered = orderedDayTimes(data);

  const weekdayPreference = WeekDayService.getReadableWeekDayInfo(selectedDays);
  const dayTimePreference = DayTimeService.getReadableDayTimeInfo(dayTimesOrdered).replace(/\n/g, ' ').trim();

  const scheduleDayString = (day: WeekDay): string | null => {
    const slots = dayTimes[day];
    return slots?.length ? slots.join(', ') : null;
  };

  const matching = new PrismaRacketMatchingPersistence(prisma);
  await matching.upsertProfile({
    userId,
    sport: 'volleyball',
    preferredGenders: '',
    preferredAges: '',
    playLevel: levelReadable(data.vbLevelKey ?? ''),
    playLevelCode: data.vbLevelKey || DEFAULT_VOLLEYBALL_LEVEL_CODE,
    playerGender: null,
    playerAgeBand: null,
    weekdayPreference,
    dayTimePreference,
  });
  await matching.upsertSchedule({
    userId,
    sport: 'volleyball',
    monday: scheduleDayString('monday'),
    tuesday: scheduleDayString('tuesday'),
    wednesday: scheduleDayString('wednesday'),
    thursday: scheduleDayString('thursday'),
    friday: scheduleDayString('friday'),
    saturday: scheduleDayString('saturday'),
    sunday: scheduleDayString('sunday'),
  });

  await upsertUserSportProfileRow(userId, 'volleyball', {
    volleyballSkillTag: data.vbLevelKey ?? null,
    volleyballFormats: formats.join(',') || null,
    wantsOrganizeVolleyball: Boolean(data.vbWantOrganize),
  });

  await setUserVolleyballOnboardingSummary(userId, data.vbLevelKey ?? undefined);
}

export async function loadVolleyballDraftFromDb(
  userId: string,
  data: OnboardingSessionData,
): Promise<void> {
  const sp = await prisma.userSportProfile.findUnique({
    where: { userId_sport: { userId, sport: 'volleyball' } },
  });
  const formats = (sp?.volleyballFormats ?? '').split(',').filter(Boolean);
  data.vbFormats = {
    classic: formats.includes(VOLLEYBALL_FORMAT_DB.classic),
    beach: formats.includes(VOLLEYBALL_FORMAT_DB.beach),
  };
  data.vbLevelKey = sp?.volleyballSkillTag ?? undefined;
  const sched = await prisma.matchingSchedule.findUnique({
    where: { userId_sport: { userId, sport: 'volleyball' } },
  });
  data.vbWeekDays = [];
  data.vbDayTimes = {} as Record<WeekDay, DayTime[]>;
  if (sched) {
    for (const day of WEEK_DAYS_ALL) {
      const col = sched[day] as string | null;
      if (col?.trim()) {
        data.vbWeekDays.push(day);
        data.vbDayTimes[day] = col.split(',').map(s => s.trim()) as DayTime[];
      }
    }
  }
  data.vbWantOrganize = Boolean(sp?.wantsOrganizeVolleyball);
  if (data.vbWeekDays.length) {
    data.vbWeekDays = sortWeekDaysCalendar(data.vbWeekDays);
  }
}
