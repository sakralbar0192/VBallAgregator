import { prisma } from '../../../core/src/infrastructure/prisma.js';
import { PrismaRacketMatchingPersistence } from '../../../core/src/infrastructure/prisma-racket-matching-persistence.js';
import { upsertUserSportProfileRow } from '../../../core/src/application/use-cases.js';
import { LoggerFactory } from '../../../core/src/shared/layer-logger.js';
import DayTimeService from './services/day-time.js';
import PlayerAgeService from './services/player-age.js';
import PlayLevelService from './services/play-level.js';
import PreferredAgeService from './services/prefer-age.js';
import PreferredGenderService from './services/prefer-gender.js';
import WeekDayService from './services/week-day.js';
import { WEEKDAY_CALENDAR_ORDER, sortWeekDaysCalendar } from './week-day-calendar.js';
import type { DayTime, PlayLevel, PlayerAge, PreferredAge, PreferredGender, WeekDay, WizardState } from './types.js';
import { TennisText } from './tennis-text.js';

const log = LoggerFactory.bot('racket-profile-setup');

function scheduleDayString(
  dayTimes: Record<WeekDay, DayTime[]> | undefined,
  day: WeekDay,
): string | null {
  const slots = dayTimes?.[day];
  return slots?.length ? slots.join(', ') : null;
}

/** Расписание в календарном порядке дней — для текста и стабильного порядка ключей. */
function dayTimesInCalendarOrder(dayTimes: Record<WeekDay, DayTime[]>): Record<WeekDay, DayTime[]> {
  const o = {} as Record<WeekDay, DayTime[]>;
  for (const d of WEEKDAY_CALENDAR_ORDER) {
    if (dayTimes[d]?.length) o[d] = dayTimes[d];
  }
  return o;
}

function formatUserGenderLabel(raw: string | null | undefined): string {
  const t = raw?.trim();
  if (!t) return TennisText.empty;
  if (t === 'men') return TennisText.genderMen;
  if (t === 'women') return TennisText.genderWomen;
  return t;
}

function formatUserAgeBandLabel(raw: string | null | undefined): string {
  const t = raw?.trim();
  if (!t) return TennisText.empty;
  if (PlayerAgeService.isLevelValid(t)) {
    return PlayerAgeService.getReadableLevelInfo(t as PlayerAge).name;
  }
  return t;
}

/**
 * Сохраняет ракеточный профиль подбора и расписание (без Telegraf — удобно для тестов и повторного использования).
 */
export async function persistRacketProfileFromWizardState(
  telegramId: number,
  state: WizardState,
): Promise<{ userId: string }> {
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(telegramId) } });
  if (!user) {
    log.warn('persistRacketProfile', 'user not found for telegramId', { telegramId });
    throw new Error('USER_NOT_FOUND');
  }

  if (!user.gender?.trim() || !user.ageBand?.trim()) {
    log.warn('persistRacketProfile', 'missing user demographics for tennis profile', { userId: user.id });
    throw new Error('INCOMPLETE_USER_DEMOGRAPHICS');
  }

  const level = state.level as PlayLevel | undefined;
  const selectedDays = state.selectedDays as WeekDay[] | undefined;
  const dayTimes = state.dayTimes as Record<WeekDay, DayTime[]> | undefined;

  if (!level || !selectedDays?.length || !dayTimes) {
    log.error('persistRacketProfile', 'incomplete wizard state', new Error('incomplete'), {
      userId: user.id,
    });
    throw new Error('INCOMPLETE_WIZARD_STATE');
  }

  const selectedSorted = sortWeekDaysCalendar([...selectedDays]);
  const daysWithSlots = selectedSorted.filter(d => (dayTimes[d]?.length ?? 0) > 0);
  if (!daysWithSlots.length) {
    log.error('persistRacketProfile', 'no days with time slots', new Error('incomplete'), {
      userId: user.id,
    });
    throw new Error('INCOMPLETE_WIZARD_STATE');
  }
  state.selectedDays = daysWithSlots;
  const dayTimesOrdered = dayTimesInCalendarOrder(dayTimes);

  const weekdayPreference = WeekDayService.getReadableWeekDayInfo(daysWithSlots);
  const dayTimePreference = DayTimeService.getReadableDayTimeInfo(dayTimesOrdered).replace(/\n/g, ' ').trim();

  const matching = new PrismaRacketMatchingPersistence(prisma);

  await matching.upsertProfile({
    userId: user.id,
    sport: 'tennis',
    preferredGenders: state.preferGenders?.join(', ') ?? '',
    preferredAges: state.preferAges?.join(', ') ?? '',
    playLevel: PlayLevelService.getReadableLevelInfo(level),
    playLevelCode: level,
    playerGender: user.gender ?? state.gender ?? null,
    playerAgeBand: user.ageBand ?? state.age ?? null,
    weekdayPreference,
    dayTimePreference,
  });

  await matching.upsertSchedule({
    userId: user.id,
    sport: 'tennis',
    monday: scheduleDayString(dayTimes, 'monday'),
    tuesday: scheduleDayString(dayTimes, 'tuesday'),
    wednesday: scheduleDayString(dayTimes, 'wednesday'),
    thursday: scheduleDayString(dayTimes, 'thursday'),
    friday: scheduleDayString(dayTimes, 'friday'),
    saturday: scheduleDayString(dayTimes, 'saturday'),
    sunday: scheduleDayString(dayTimes, 'sunday'),
  });

  await upsertUserSportProfileRow(user.id, 'tennis');

  log.info('persistRacketProfile', 'matching profile and schedule saved', { userId: user.id });
  return { userId: user.id };
}

export async function buildTennisProfileSummaryMessage(telegramId: number, state: WizardState): Promise<string> {
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(telegramId) } });
  const daysSorted = sortWeekDaysCalendar([...((state.selectedDays ?? []) as WeekDay[])]);
  const dayTimes = state.dayTimes as Record<WeekDay, DayTime[]>;
  const dayTimesOrdered = dayTimesInCalendarOrder(dayTimes);

  const genderLine = formatUserGenderLabel(user?.gender);
  const ageLine = formatUserAgeBandLabel(user?.ageBand);

  return (
    TennisText.summaryTitle +
    TennisText.summaryPlayerGender(genderLine) +
    TennisText.summaryPlayerAge(ageLine) +
    TennisText.summaryLevel(PlayLevelService.getReadableLevelInfo(state.level as PlayLevel)) +
    TennisText.summaryDays(WeekDayService.getReadableWeekDayInfo(daysSorted)) +
    TennisText.summaryTimes(DayTimeService.getReadableDayTimeInfo(dayTimesOrdered)) +
    TennisText.summaryPreferAge(
      PreferredAgeService.getReadablePreferredAgeInfo((state.preferAges ?? []) as PreferredAge[]),
    ) +
    TennisText.summaryPreferGender(
      PreferredGenderService.getReadablePreferredGenderInfo((state.preferGenders ?? []) as PreferredGender[]),
    )
  );
}
