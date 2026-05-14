import { prisma } from '../../../core/src/infrastructure/prisma.js';
import { LoggerFactory } from '../../../core/src/shared/layer-logger.js';
import DayTimeService from './services/day-time.js';
import PlayLevelService from './services/play-level.js';
import PreferredAgeService from './services/prefer-age.js';
import PreferredGenderService from './services/prefer-gender.js';
import WeekDayService from './services/week-day.js';
import type { DayTime, PlayLevel, PreferredAge, PreferredGender, WeekDay, WizardState } from './types.js';

const log = LoggerFactory.bot('racket-profile-setup');

function scheduleDayString(
  dayTimes: Record<WeekDay, DayTime[]> | undefined,
  day: WeekDay,
): string | null {
  const slots = dayTimes?.[day];
  return slots?.length ? slots.join(', ') : null;
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

  const level = state.level as PlayLevel | undefined;
  const selectedDays = state.selectedDays as WeekDay[] | undefined;
  const dayTimes = state.dayTimes as Record<WeekDay, DayTime[]> | undefined;

  if (!level || !selectedDays?.length || !dayTimes) {
    log.error('persistRacketProfile', 'incomplete wizard state', new Error('incomplete'), {
      userId: user.id,
    });
    throw new Error('INCOMPLETE_WIZARD_STATE');
  }

  const weekdayPreference = WeekDayService.getReadableWeekDayInfo(selectedDays);
  const dayTimePreference = DayTimeService.getReadableDayTimeInfo(dayTimes).replace(/\n/g, ' ').trim();

  await prisma.matchingProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      preferredGenders: state.preferGenders?.join(', ') ?? '',
      preferredAges: state.preferAges?.join(', ') ?? '',
      playLevel: PlayLevelService.getReadableLevelInfo(level),
      playLevelCode: level,
      playerGender: state.gender ?? null,
      playerAgeBand: state.age ?? null,
      weekdayPreference,
      dayTimePreference,
    },
    update: {
      preferredGenders: state.preferGenders?.join(', ') ?? '',
      preferredAges: state.preferAges?.join(', ') ?? '',
      playLevel: PlayLevelService.getReadableLevelInfo(level),
      playLevelCode: level,
      playerGender: state.gender ?? null,
      playerAgeBand: state.age ?? null,
      weekdayPreference,
      dayTimePreference,
    },
  });

  await prisma.matchingSchedule.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      monday: scheduleDayString(dayTimes, 'monday'),
      tuesday: scheduleDayString(dayTimes, 'tuesday'),
      wednesday: scheduleDayString(dayTimes, 'wednesday'),
      thursday: scheduleDayString(dayTimes, 'thursday'),
      friday: scheduleDayString(dayTimes, 'friday'),
      saturday: scheduleDayString(dayTimes, 'saturday'),
      sunday: scheduleDayString(dayTimes, 'sunday'),
    },
    update: {
      monday: scheduleDayString(dayTimes, 'monday'),
      tuesday: scheduleDayString(dayTimes, 'tuesday'),
      wednesday: scheduleDayString(dayTimes, 'wednesday'),
      thursday: scheduleDayString(dayTimes, 'thursday'),
      friday: scheduleDayString(dayTimes, 'friday'),
      saturday: scheduleDayString(dayTimes, 'saturday'),
      sunday: scheduleDayString(dayTimes, 'sunday'),
    },
  });

  log.info('persistRacketProfile', 'matching profile and schedule saved', { userId: user.id });
  return { userId: user.id };
}

export function buildRacketProfileSummaryMessage(state: WizardState): string {
  const selectedDays = state.selectedDays as WeekDay[] | undefined;
  const dayTimes = state.dayTimes as Record<WeekDay, DayTime[]> | undefined;
  return (
    '✅ Профиль настроен!\n\n' +
    `Уровень: ${PlayLevelService.getReadableLevelInfo(state.level as PlayLevel)}\n` +
    `Дни: ${WeekDayService.getReadableWeekDayInfo(selectedDays as WeekDay[])}\n` +
    `Время: ${DayTimeService.getReadableDayTimeInfo(dayTimes as Record<WeekDay, DayTime[]>)}\n` +
    `Предпочтительный возраст: ${PreferredAgeService.getReadablePreferredAgeInfo((state.preferAges ?? []) as PreferredAge[])}\n` +
    `Предпочтительный пол: ${PreferredGenderService.getReadablePreferredGenderInfo((state.preferGenders ?? []) as PreferredGender[])}\n`
  );
}
